

import { Injectable, Inject, Optional } from '@nestjs/common';
import { SelectQueryBuilder, Brackets, ObjectLiteral } from 'typeorm';
import {
	getFilterableFields,
	getSortableFields,
	getSearchableFields,
	ISearchStrategy,
	SearchableFieldType,
} from '@exprealty/database'
import {
  QueryParamsSchema,
  NormalizedQueryParamsSchema,
} from '@exprealty/shared-domain';
import type {
  QueryParams,
  NormalizedQueryParams,
  Filter,
  FilterCondition,
  Sort,
  FilterOperator,
  LogicalOperator,
} from '@exprealty/shared-domain';
import { SEARCH_STRATEGIES } from './query.tokens.js';
import { SearchMetadataReader } from './search-metadata-reader.service.js';
import { ColumnResolverService } from './column-resolver.service.js';
import { SearchValidationException } from '../exceptions/search-validation.exception.js';

/**
 * Map of field types to search strategies
 */
type StrategyMap = Record<string, ISearchStrategy>;

@Injectable()
export class QueryService {
  constructor(
    @Optional() @Inject(SEARCH_STRATEGIES) private readonly strategies?: StrategyMap,
    @Optional() private readonly searchMetadataReader?: SearchMetadataReader,
    @Optional() private readonly columnResolver?: ColumnResolverService,
  ) {}
  /**
   * Parse and normalize query params with entity field validation
   */
  normalizeWithValidation<T>(
    query: Partial<QueryParams>,
    entityClass: new (...args: any[]) => T,
  ): NormalizedQueryParams {
    const parsed = QueryParamsSchema.parse(query);
    
    // Get allowed fields from entity decorators
    const allowedFilterFields = new Set<string>(getFilterableFields(entityClass));
    const allowedSortFields = new Set<string>(getSortableFields(entityClass));
    const allowedSearchFields = new Set<string>(getSearchableFields(entityClass));

    // Build normalized structure
    const normalized: NormalizedQueryParams = {
      offset: parsed.offset,
      limit: parsed.limit,
      filter: parsed.filter,
      sort: parsed.sort,
    };

    // Validate filters
    if (normalized.filter?.conditions) {
      this.validateFilterFields(normalized.filter.conditions, allowedFilterFields);
    }

    // Validate sorts
    if (normalized.sort?.conditions) {
      this.validateSortFields(normalized.sort.conditions, allowedSortFields);
    }

    // Add and validate search
    if (parsed.search && parsed.searchFields && parsed.searchFields.length > 0) {
      this.validateSearchFields(parsed.searchFields, allowedSearchFields);
      normalized.search = {
        query: parsed.search,
        fields: parsed.searchFields,
      };
    } else if (parsed.search && allowedSearchFields.size > 0) {
      // Use all searchable fields if none specified
      normalized.search = {
        query: parsed.search,
        fields: Array.from(allowedSearchFields) as string[],
      };
    }

    return NormalizedQueryParamsSchema.parse(normalized);
  }

  /**
   * Validate filter fields against allowed fields
   */
  private validateFilterFields(
    conditions: FilterCondition[],
    allowedFields: Set<string>,
  ): void {
    if (allowedFields.size === 0) return;
    
    const invalidFields = conditions
      .map((c) => c.field)
      .filter((field) => !allowedFields.has(field));

    if (invalidFields.length > 0) {
      throw new Error(
        `Invalid filter fields: ${invalidFields.join(', ')}. ` +
        `Allowed fields: ${Array.from(allowedFields).join(', ')}`,
      );
    }
  }

  /**
   * Validate sort fields against allowed fields
   */
  private validateSortFields(
    conditions: Array<{ field: string; direction: any }>,
    allowedFields: Set<string>,
  ): void {
    if (allowedFields.size === 0) return;
    
    const invalidFields = conditions
      .map((c) => c.field)
      .filter((field) => !allowedFields.has(field));

    if (invalidFields.length > 0) {
      throw new Error(
        `Invalid sort fields: ${invalidFields.join(', ')}. ` +
        `Allowed fields: ${Array.from(allowedFields).join(', ')}`,
      );
    }
  }

  /**
   * Validate search fields against allowed fields
   */
  private validateSearchFields(
    fields: string[],
    allowedFields: Set<string>,
  ): void {
    if (allowedFields.size === 0) return;
    
    const invalidFields = fields.filter((field) => !allowedFields.has(field));

    if (invalidFields.length > 0) {
      throw new Error(
        `Invalid search fields: ${invalidFields.join(', ')}. ` +
        `Allowed fields: ${Array.from(allowedFields).join(', ')}`,
      );
    }
  }

  /**
   * Parse and normalize query params (includes your pagination)
   */
  normalize(query: Partial<QueryParams>): NormalizedQueryParams {
    const parsed = QueryParamsSchema.parse(query);
    
    // Build normalized structure
    const normalized: NormalizedQueryParams = {
      offset: parsed.offset,
      limit: parsed.limit,
      filter: parsed.filter,
      sort: parsed.sort,
    };

    // Add search if both query and fields present
    if (parsed.search && parsed.searchFields && parsed.searchFields.length > 0) {
      normalized.search = {
        query: parsed.search,
        fields: parsed.searchFields,
      };
    }

    return NormalizedQueryParamsSchema.parse(normalized);
  }

  /**
   * Apply filters to TypeORM query builder.
   * Handles reserved word column names by quoting them.
   */
  applyFilters<T>(
    qb: SelectQueryBuilder<T>,
    filter: Filter | undefined,
    alias: string,
    allowedFields?: Set<string>,
  ): SelectQueryBuilder<T> {
    if (!filter || !filter.conditions || filter.conditions.length === 0) {
      return qb;
    }

    const { conditions, logicalOperator } = filter;

    qb.andWhere(
      new Brackets((subQb) => {
        conditions.forEach((condition, index) => {
          // Validate field is allowed
          if (allowedFields && allowedFields.size > 0 && !allowedFields.has(condition.field)) {
            throw new Error(`Field '${condition.field}' is not allowed for filtering`);
          }

          const paramName = `filter_${condition.field}_${index}`;
          // Quote the field name if it's a reserved word
          const quotedField = this.quoteIfReserved(condition.field);
          const fieldPath = `${alias}.${quotedField}`;
          const whereMethod = logicalOperator === 'OR' ? 'orWhere' : 'andWhere';

          this.applyFilterCondition(subQb, condition, fieldPath, paramName, whereMethod);
        });
      }),
    );

    return qb;
  }

  /**
   * Apply a single filter condition
   */
  private applyFilterCondition(
    qb: any, // Can be QueryBuilder or Brackets
    condition: FilterCondition,
    fieldPath: string,
    paramName: string,
    whereMethod: 'andWhere' | 'orWhere',
  ): void {
    const { operator, value } = condition;

    switch (operator) {
      case 'eq':
        qb[whereMethod](`${fieldPath} = :${paramName}`, { [paramName]: value });
        break;
      case 'ne':
        qb[whereMethod](`${fieldPath} != :${paramName}`, { [paramName]: value });
        break;
      case 'gt':
        qb[whereMethod](`${fieldPath} > :${paramName}`, { [paramName]: value });
        break;
      case 'gte':
        qb[whereMethod](`${fieldPath} >= :${paramName}`, { [paramName]: value });
        break;
      case 'lt':
        qb[whereMethod](`${fieldPath} < :${paramName}`, { [paramName]: value });
        break;
      case 'lte':
        qb[whereMethod](`${fieldPath} <= :${paramName}`, { [paramName]: value });
        break;
      case 'like':
        qb[whereMethod](`${fieldPath} LIKE :${paramName}`, { [paramName]: `%${value}%` });
        break;
      case 'ilike':
        qb[whereMethod](`${fieldPath} ILIKE :${paramName}`, { [paramName]: `%${value}%` });
        break;
      case 'in':
        qb[whereMethod](`${fieldPath} IN (:...${paramName})`, { [paramName]: value });
        break;
      case 'nin':
        qb[whereMethod](`${fieldPath} NOT IN (:...${paramName})`, { [paramName]: value });
        break;
      case 'between':
        qb[whereMethod](`${fieldPath} BETWEEN :${paramName}_start AND :${paramName}_end`, {
          [`${paramName}_start`]: value[0],
          [`${paramName}_end`]: value[1],
        });
        break;
      case 'isNull':
        qb[whereMethod](`${fieldPath} IS NULL`);
        break;
      case 'isNotNull':
        qb[whereMethod](`${fieldPath} IS NOT NULL`);
        break;
      case 'startsWith':
        qb[whereMethod](`${fieldPath} ILIKE :${paramName}`, { [paramName]: `${value}%` });
        break;
      case 'endsWith':
        qb[whereMethod](`${fieldPath} ILIKE :${paramName}`, { [paramName]: `%${value}` });
        break;
      case 'contains':
        qb[whereMethod](`${fieldPath} ILIKE :${paramName}`, { [paramName]: `%${value}%` });
        break;
      default:
        throw new Error(`Unsupported filter operator: ${operator}`);
    }
  }

  /**
   * PostgreSQL reserved words that need to be quoted in ORDER BY clauses.
   * These are common reserved words that might be used as column names.
   * @see https://www.postgresql.org/docs/current/sql-keywords-appendix.html
   */
  private static readonly RESERVED_WORDS = new Set([
    'number', 'order', 'group', 'user', 'table', 'column', 'index',
    'key', 'value', 'type', 'name', 'date', 'time', 'timestamp',
    'year', 'month', 'day', 'hour', 'minute', 'second', 'position',
    'row', 'rows', 'limit', 'offset', 'select', 'from', 'where',
    'and', 'or', 'not', 'null', 'true', 'false', 'default', 'check',
    'primary', 'foreign', 'references', 'unique', 'constraint',
  ]);

  /**
   * Quote a field name if it's a reserved word in PostgreSQL.
   * This prevents SQL syntax errors when sorting on columns with reserved names.
   * 
   * @param field - The field name to potentially quote
   * @returns The field name, quoted if necessary
   */
  private quoteIfReserved(field: string): string {
    if (QueryService.RESERVED_WORDS.has(field.toLowerCase())) {
      return `"${field}"`;
    }
    return field;
  }

  /**
   * Apply sorting to TypeORM query builder.
   * Handles reserved word column names by quoting them.
   */
  applySorting<T>(
    qb: SelectQueryBuilder<T>,
    sort: Sort | undefined,
    alias: string,
    allowedFields?: Set<string>,
  ): SelectQueryBuilder<T> {
    if (!sort || !sort.conditions || sort.conditions.length === 0) {
      return qb;
    }

    sort.conditions.forEach((condition, index) => {
      // Validate field is allowed
      if (allowedFields && allowedFields.size > 0 && !allowedFields.has(condition.field)) {
        throw new Error(`Field '${condition.field}' is not allowed for sorting`);
      }

      // Quote the field name if it's a reserved word
      const quotedField = this.quoteIfReserved(condition.field);
      
      // First condition uses orderBy (sets primary sort), subsequent use addOrderBy
      if (index === 0) {
        qb.orderBy(`${alias}.${quotedField}`, condition.direction);
      } else {
        qb.addOrderBy(`${alias}.${quotedField}`, condition.direction);
      }
    });

    return qb;
  }

  /**
   * Apply search to TypeORM query builder.
   * Handles reserved word column names by quoting them.
   * Note: @Searchable() should only be applied to text/string columns since ILIKE is used.
   * @deprecated Use applyStrategySearch for type-aware search
   */
  applySearch<T>(
    qb: SelectQueryBuilder<T>,
    search: { query: string; fields: string[] } | undefined,
    alias: string,
    allowedFields?: Set<string>,
  ): SelectQueryBuilder<T> {
    if (!search || !search.query || !search.fields || search.fields.length === 0) {
      return qb;
    }

    qb.andWhere(
      new Brackets((subQb) => {
        search.fields.forEach((field, index) => {
          // Validate field is allowed
          if (allowedFields && allowedFields.size > 0 && !allowedFields.has(field)) {
            throw new Error(`Field '${field}' is not allowed for searching`);
          }

          const paramName = `search_${index}`;
          // Quote the field name if it's a reserved word
          const quotedField = this.quoteIfReserved(field);
          subQb.orWhere(`${alias}.${quotedField} ILIKE :${paramName}`, {
            [paramName]: `%${search.query}%`,
          });
        });
      }),
    );

    return qb;
  }

  /**
   * Apply type-aware search using registered strategies.
   * Supports searching across string, numeric, date, and boolean fields.
   * 
   * Uses the hybrid approach:
   * - For simple operations: Uses property name (TypeORM resolves)
   * - For raw SQL fragments (CAST, EXTRACT): Uses actual column name via ColumnResolver
   * 
   * @param qb - TypeORM SelectQueryBuilder
   * @param searchQuery - The search term
   * @param entityClass - Entity class for metadata lookup
   * @param alias - Query builder alias
   * @returns The modified query builder
   */
  applyStrategySearch<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    searchQuery: string | undefined,
    entityClass: new (...args: any[]) => T,
    alias: string,
  ): SelectQueryBuilder<T> {
    if (!searchQuery || !this.strategies || !this.searchMetadataReader) {
      return qb;
    }

    // Get searchable field configurations from metadata
    const fieldConfigs = this.searchMetadataReader.getSearchableFieldsConfig(entityClass);
    
    if (fieldConfigs.length === 0) {
      return qb;
    }

    // Validate search term against all field validators
    // Throw SearchValidationException on first failure for proper i18n error response
    for (const config of fieldConfigs) {
      if (config.validate) {
        const result = config.validate(searchQuery, config.field, config.type);
        if (!result.valid && result.error) {
          // Determine validation constraints from the error message
          const validation = this.extractValidationConstraints(result.error);
          
          throw new SearchValidationException(
            config.field,
            searchQuery,
            result.error,
            validation,
          );
        }
      }
    }

    qb.andWhere(
      new Brackets((subQb) => {
        fieldConfigs.forEach((config, index) => {
          const strategy = this.strategies![config.type];
          
          if (strategy && strategy.canHandle(searchQuery, config)) {
            const paramName = `search_${config.field}_${index}`;
            strategy.applySearch(qb, alias, config.field, searchQuery, paramName);
          }
        });
      }),
    );

    return qb;
  }

  /**
   * Apply all query operations (filter, sort, search) to TypeORM query builder
   */
  applyAll<T>(
    qb: SelectQueryBuilder<T>,
    params: NormalizedQueryParams,
    alias: string,
    options?: {
      allowedFilterFields?: Set<string>;
      allowedSortFields?: Set<string>;
      allowedSearchFields?: Set<string>;
    },
  ): SelectQueryBuilder<T> {
    // Apply filters
    this.applyFilters(qb, params.filter, alias, options?.allowedFilterFields);

    // Apply search
    this.applySearch(qb, params.search, alias, options?.allowedSearchFields);

    // Apply sorting
    this.applySorting(qb, params.sort, alias, options?.allowedSortFields);

    return qb;
  }

  /**
   * Apply all query operations with strategy-based search.
   * Use this for entities that have numeric/date @Searchable fields.
   */
  applyAllWithStrategies<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    params: NormalizedQueryParams,
    entityClass: new (...args: any[]) => T,
    alias: string,
    options?: {
      allowedFilterFields?: Set<string>;
      allowedSortFields?: Set<string>;
    },
  ): SelectQueryBuilder<T> {
    // Apply filters
    this.applyFilters(qb, params.filter, alias, options?.allowedFilterFields);

    // Apply strategy-based search
    this.applyStrategySearch(qb, params.search?.query, entityClass, alias);

    // Apply sorting
    this.applySorting(qb, params.sort, alias, options?.allowedSortFields);

    return qb;
  }

  /**
   * Extract validation constraints from error message.
   * Used to populate SearchValidationException with constraint info.
   */
  private extractValidationConstraints(errorMessage: string): { min?: number; max?: number } | undefined {
    // Match patterns like "out of range for integer (-2147483648 to 2147483647)"
    // or "out of range for bigint (-9223372036854775808 to 9223372036854775807)"
    const rangeMatch = errorMessage.match(/\((-?[\d.]+(?:e[+-]?\d+)?) to (-?[\d.]+(?:e[+-]?\d+)?)\)/i);
    if (rangeMatch) {
      return {
        min: parseFloat(rangeMatch[1]),
        max: parseFloat(rangeMatch[2]),
      };
    }

    // Match patterns like "must be at least X" or "must be at most X"
    const minMatch = errorMessage.match(/must be at least (-?\d+(?:\.\d+)?)/);
    const maxMatch = errorMessage.match(/must be at most (-?\d+(?:\.\d+)?)/);
    if (minMatch || maxMatch) {
      return {
        min: minMatch ? parseFloat(minMatch[1]) : undefined,
        max: maxMatch ? parseFloat(maxMatch[1]) : undefined,
      };
    }

    // Match patterns like "must be positive"
    if (errorMessage.includes('must be positive')) {
      return { min: 0 };
    }

    // Fallback: if error mentions "out of range", return empty range object
    // This allows i18n type inference to detect it as a range error
    if (errorMessage.includes('out of range')) {
      return { min: undefined, max: undefined };
    }

    return undefined;
  }
}