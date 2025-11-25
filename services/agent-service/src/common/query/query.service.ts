

import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder, Brackets } from 'typeorm';
import {
	getFilterableFields,
	getSortableFields,
	getSearchableFields,
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

@Injectable()
export class QueryService {
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
   * Apply filters to TypeORM query builder
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
          const fieldPath = `${alias}.${condition.field}`;
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
   * Apply sorting to TypeORM query builder
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

    sort.conditions.forEach((condition) => {
      // Validate field is allowed
      if (allowedFields && allowedFields.size > 0 && !allowedFields.has(condition.field)) {
        throw new Error(`Field '${condition.field}' is not allowed for sorting`);
      }

      qb.addOrderBy(`${alias}.${condition.field}`, condition.direction);
    });

    return qb;
  }

  /**
   * Apply search to TypeORM query builder
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
          subQb.orWhere(`${alias}.${field} ILIKE :${paramName}`, {
            [paramName]: `%${search.query}%`,
          });
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
}