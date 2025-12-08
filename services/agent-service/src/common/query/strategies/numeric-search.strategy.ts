// packages/@trupryce/shared-domain/src/query/strategies/numeric-search.strategy.ts

import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder, Brackets } from 'typeorm';
import { ISearchStrategy, SearchableFieldConfig } from '@exprealty/database';
import { ColumnResolverService } from '../column-resolver.service.js';

@Injectable()
export class NumericSearchStrategy implements ISearchStrategy {
  constructor(private readonly columnResolver: ColumnResolverService) {}

  applySearch<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,        // ← TypeScript property name (e.g., 'listPrice')
    searchTerm: string,
    parameterName: string,
  ): void {
    // ✅ Get actual database column name
    const entityClass = qb.expressionMap.mainAlias!.metadata.target as new () => T;
    const columnName = this.columnResolver.getColumnName(entityClass, field);

    // Range search (e.g., "500-1000")
    const rangeMatch = searchTerm.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    
    if (rangeMatch) {
      const [, min, max] = rangeMatch;
      // ✅ Use actual column name
      qb.orWhere(`${alias}.${columnName} BETWEEN :${parameterName}_min AND :${parameterName}_max`, {
        [`${parameterName}_min`]: parseFloat(min),
        [`${parameterName}_max`]: parseFloat(max),
      });
      return;
    }

    const numericValue = this.parseNumeric(searchTerm);
    
    if (numericValue !== null) {
      qb.orWhere(
        new Brackets((subQb) => {
          // Strategy 1: Exact match
          // ✅ TypeORM handles property → column here
          subQb.where(`${alias}.${field} = :${parameterName}_exact`, {
            [`${parameterName}_exact`]: numericValue,
          });

          // Strategy 2: Cast to text for partial match
          // ✅ Use actual column name in raw SQL
          if (!searchTerm.includes('.') || searchTerm.split('.')[1].length < 2) {
            subQb.orWhere(`CAST(${alias}.${columnName} AS TEXT) ILIKE :${parameterName}_text`, {
              [`${parameterName}_text`]: `%${searchTerm}%`,
            });
          }
        }),
      );
    } else {
      // ✅ Use actual column name in CAST
      qb.orWhere(`CAST(${alias}.${columnName} AS TEXT) ILIKE :${parameterName}`, {
        [parameterName]: `%${searchTerm}%`,
      });
    }
  }

  canHandle(searchTerm: string, config: SearchableFieldConfig): boolean {
    const isNumeric = this.parseNumeric(searchTerm) !== null;
    const isRange = /^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(searchTerm);
    return isNumeric || isRange || searchTerm.trim().length > 0;
  }

  private parseNumeric(searchTerm: string): number | null {
    const cleaned = searchTerm
      .replace(/[$,]/g, '')
      .replace(/k$/i, '000')
      .replace(/m$/i, '000000')
      .trim();

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
}