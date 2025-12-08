
import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder, Brackets } from 'typeorm';
import { ISearchStrategy, SearchableFieldConfig } from '@exprealty/database';
import { ColumnResolverService } from '../column-resolver.service.js';

@Injectable()
export class DateSearchStrategy implements ISearchStrategy {
  constructor(private readonly columnResolver: ColumnResolverService) {}

  applySearch<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,
    searchTerm: string,
    parameterName: string,
  ): void {
    // ✅ Get actual database column name
    const entityClass = qb.expressionMap.mainAlias!.metadata.target as new () => T;
    const columnName = this.columnResolver.getColumnName(entityClass, field);

    const cleaned = searchTerm.trim();

    // Check if it's a year (4 digits)
    if (/^\d{4}$/.test(cleaned)) {
      const year = parseInt(cleaned, 10);
      qb.orWhere(
        new Brackets((subQb) => {
          // For integer year_built columns
          // ✅ TypeORM handles property → column
          subQb.where(`${alias}.${field} = :${parameterName}_year`, {
            [`${parameterName}_year`]: year,
          });

          // For date columns (extract year)
          // ✅ Use actual column name in EXTRACT function
          subQb.orWhere(`EXTRACT(YEAR FROM ${alias}.${columnName}) = :${parameterName}_extract`, {
            [`${parameterName}_extract`]: year,
          });
        }),
      );
      return;
    }

    // Check if it's YYYY-MM format
    const monthMatch = cleaned.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      const [, year, month] = monthMatch;
      const startDate = `${year}-${month}-01`;
      const endDate = this.getEndOfMonth(parseInt(year), parseInt(month));

      // ✅ TypeORM handles property → column in BETWEEN
      qb.orWhere(`${alias}.${field} BETWEEN :${parameterName}_start AND :${parameterName}_end`, {
        [`${parameterName}_start`]: startDate,
        [`${parameterName}_end`]: endDate,
      });
      return;
    }

    // Check if it's a full date YYYY-MM-DD
    const dateMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      // ✅ TypeORM handles property → column
      qb.orWhere(`${alias}.${field} = :${parameterName}_date`, {
        [`${parameterName}_date`]: cleaned,
      });
      return;
    }

    // Fallback: Cast to text and search
    // ✅ Use actual column name in CAST
    qb.orWhere(`CAST(${alias}.${columnName} AS TEXT) ILIKE :${parameterName}`, {
      [parameterName]: `%${cleaned}%`,
    });
  }

  canHandle(searchTerm: string, config: SearchableFieldConfig): boolean {
    return true;
  }

  private getEndOfMonth(year: number, month: number): string {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
}