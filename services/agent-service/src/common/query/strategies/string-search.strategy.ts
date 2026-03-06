import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { ISearchStrategy, SearchableFieldConfig } from '@exprealty/database';

@Injectable()
export class StringSearchStrategy implements ISearchStrategy {
  applySearch<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,  // ← Property name
    searchTerm: string,
    parameterName: string,
  ): void {
    const behavior = this.getSearchBehavior(field);

    switch (behavior) {
      case 'exact':
        // ✅ TypeORM handles property → column in LOWER()
        qb.orWhere(`LOWER(${alias}.${field}) = LOWER(:${parameterName})`, {
          [parameterName]: searchTerm,
        });
        break;

      case 'prefix':
        // ✅ TypeORM handles property → column in ILIKE
        qb.orWhere(`${alias}.${field} ILIKE :${parameterName}`, {
          [parameterName]: `${searchTerm}%`,
        });
        break;

      case 'suffix':
        qb.orWhere(`${alias}.${field} ILIKE :${parameterName}`, {
          [parameterName]: `%${searchTerm}`,
        });
        break;

      case 'partial':
      default:
        qb.orWhere(`${alias}.${field} ILIKE :${parameterName}`, {
          [parameterName]: `%${searchTerm}%`,
        });
        break;
    }
  }

  canHandle(searchTerm: string, config: SearchableFieldConfig): boolean {
    return true;
  }

  private getSearchBehavior(field: string): string {
    return 'partial';
  }
}