
import { SelectQueryBuilder, Brackets } from 'typeorm';
import { FilterOperatorEnum, LogicalOperatorEnum } from '@exprealty/shared-domain';
import type { FilterOperator, LogicalOperator } from '@exprealty/shared-domain';
import { FilterDto } from './filter.dto.js';
import { SortDto } from './sort.dto.js';
import { SearchDto } from './search.dto.js';
import { PaginationDto } from './query-params.dto.js';

export class QueryBuilderHelper<T> {
  constructor(
    private queryBuilder: SelectQueryBuilder<T>,
    private alias: string,
    private allowedFields: Set<string> = new Set(),
  ) {}

  /**
   * Apply filters to query builder
   */
  applyFilters(filterDto?: FilterDto): this {
    if (!filterDto?.conditions || filterDto.conditions.length === 0) {
      return this;
    }

    const { conditions, logicalOperator } = filterDto;

    this.queryBuilder.andWhere(
      new Brackets((qb) => {
        conditions.forEach((condition, index) => {
          // Validate field is allowed
          if (this.allowedFields.size > 0 && !this.allowedFields.has(condition.field)) {
            throw new Error(`Field '${condition.field}' is not allowed for filtering`);
          }

          const paramName = `filter_${condition.field}_${index}`;
          const fieldPath = `${this.alias}.${condition.field}`;

          const whereClause = this.buildWhereClause(fieldPath, condition.operator, paramName);
          const whereMethod = logicalOperator === 'OR' ? 'orWhere' : 'andWhere';

          if (condition.operator === 'isNull') {
            qb[whereMethod](`${fieldPath} IS NULL`);
          } else if (condition.operator === 'isNotNull') {
            qb[whereMethod](`${fieldPath} IS NOT NULL`);
          } else if (condition.operator === 'between') {
            qb[whereMethod](`${fieldPath} BETWEEN :${paramName}_start AND :${paramName}_end`, {
              [`${paramName}_start`]: condition.value[0],
              [`${paramName}_end`]: condition.value[1],
            });
          } else {
            qb[whereMethod](whereClause, { [paramName]: condition.value });
          }
        });
      })
    );

    return this;
  }

  /**
   * Apply sorting to query builder
   */
  applySorting(sortDto?: SortDto): this {
    if (!sortDto?.sort || sortDto.sort.length === 0) {
      return this;
    }

    sortDto.sort.forEach((sortCondition) => {
      // Validate field is allowed
      if (this.allowedFields.size > 0 && !this.allowedFields.has(sortCondition.field)) {
        throw new Error(`Field '${sortCondition.field}' is not allowed for sorting`);
      }

      this.queryBuilder.addOrderBy(
        `${this.alias}.${sortCondition.field}`,
        sortCondition.direction
      );
    });

    return this;
  }

  /**
   * Apply full-text search to query builder
   */
  applySearch(searchDto?: SearchDto): this {
    if (!searchDto?.query || !searchDto?.fields || searchDto.fields.length === 0) {
      return this;
    }

    this.queryBuilder.andWhere(
      new Brackets((qb) => {
        searchDto.fields.forEach((field, index) => {
          // Validate field is allowed
          if (this.allowedFields.size > 0 && !this.allowedFields.has(field)) {
            throw new Error(`Field '${field}' is not allowed for searching`);
          }

          const paramName = `search_${index}`;
          qb.orWhere(`${this.alias}.${field} ILIKE :${paramName}`, {
            [paramName]: `%${searchDto.query}%`,
          });
        });
      })
    );

    return this;
  }

  /**
   * Apply pagination to query builder
   */
  applyPagination(paginationDto: PaginationDto): this {
    const { page, limit } = paginationDto;
    const skip = (page - 1) * limit;

    this.queryBuilder.skip(skip).take(limit);

    return this;
  }

  /**
   * Build WHERE clause based on operator
   */
  private buildWhereClause(field: string, operator: FilterOperator, paramName: string): string {
    switch (operator) {
      case 'eq':
        return `${field} = :${paramName}`;
      case 'ne':
        return `${field} != :${paramName}`;
      case 'gt':
        return `${field} > :${paramName}`;
      case 'gte':
        return `${field} >= :${paramName}`;
      case 'lt':
        return `${field} < :${paramName}`;
      case 'lte':
        return `${field} <= :${paramName}`;
      case 'like':
        return `${field} LIKE :${paramName}`;
      case 'ilike':
        return `${field} ILIKE :${paramName}`;
      case 'in':
        return `${field} IN (:...${paramName})`;
      case 'nin':
        return `${field} NOT IN (:...${paramName})`;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Get the underlying QueryBuilder
   */
  getQueryBuilder(): SelectQueryBuilder<T> {
    return this.queryBuilder;
  }

  /**
   * Execute and return paginated results
   */
  async paginate(paginationDto: PaginationDto) {
    const [data, total] = await this.queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page: paginationDto.page,
        limit: paginationDto.limit,
        totalPages: Math.ceil(total / paginationDto.limit),
        hasNextPage: paginationDto.page < Math.ceil(total / paginationDto.limit),
        hasPreviousPage: paginationDto.page > 1,
      },
    };
  }
}