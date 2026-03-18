
import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { ISearchStrategy, SearchableFieldConfig } from '@exprealty/database';

/**
 * Boolean search strategy
 * Handles boolean columns
 * 
 * Examples:
 * - "true", "yes", "1" → pool_yn = true
 * - "false", "no", "0" → pool_yn = false
 */
@Injectable()
export class BooleanSearchStrategy implements ISearchStrategy {
  private readonly TRUE_VALUES = new Set(['true', 'yes', '1', 'y', 't','active','ac','act','acti','activ']);
  private readonly FALSE_VALUES = new Set(['false', 'no', '0', 'n', 'f','inactive','ina','inac','inact','inacti','inactiv']);

  applySearch<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,
    searchTerm: string,
    parameterName: string,
  ): void {
    const cleaned = searchTerm.toLowerCase().trim();

    if (this.TRUE_VALUES.has(cleaned)) {
      qb.orWhere(`${alias}.${field} = :${parameterName}`, {
        [parameterName]: true,
      });
    } else if (this.FALSE_VALUES.has(cleaned)) {
      qb.orWhere(`${alias}.${field} = :${parameterName}`, {
        [parameterName]: false,
      });
    }
    // If not a recognized boolean value, skip this field
  }

  canHandle(searchTerm: string, config: SearchableFieldConfig): boolean {
    const cleaned = searchTerm.toLowerCase().trim();
    return this.TRUE_VALUES.has(cleaned) || this.FALSE_VALUES.has(cleaned);
  }
}