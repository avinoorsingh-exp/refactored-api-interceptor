import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
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
    // Get actual database column name for raw SQL
    const entityClass = qb.expressionMap.mainAlias!.metadata.target as new () => T;
    const columnName = this.columnResolver.getColumnName(entityClass, field);

    const cleaned = searchTerm.trim();

    // Check if it's a valid year (4 digits, reasonable range 1900-2100)
    if (/^\d{4}$/.test(cleaned)) {
      const year = parseInt(cleaned, 10);
      
      // Only accept reasonable year values for date searching
      if (year >= 1900 && year <= 2100) {
        // Use EXTRACT for date/timestamp columns
        qb.orWhere(`EXTRACT(YEAR FROM ${alias}.${columnName}) = :${parameterName}_year`, {
          [`${parameterName}_year`]: year,
        });
        return;
      }
      
      // Year out of range (like 6740) - skip this field, no results
      return;
    }

    // Check if it's YYYY-MM format
    const monthMatch = cleaned.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      const [, yearStr, month] = monthMatch;
      const year = parseInt(yearStr, 10);
      
      // Validate year range
      if (year < 1900 || year > 2100) {
        return; // Skip invalid year
      }
      
      const startDate = `${yearStr}-${month}-01`;
      const endDate = this.getEndOfMonth(year, parseInt(month));

      qb.orWhere(`${alias}.${columnName} >= :${parameterName}_start AND ${alias}.${columnName} < :${parameterName}_end`, {
        [`${parameterName}_start`]: startDate,
        [`${parameterName}_end`]: this.addDay(endDate),
      });
      return;
    }

    // Check if it's a full date YYYY-MM-DD
    const dateMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const [, yearStr] = dateMatch;
      const year = parseInt(yearStr, 10);
      
      // Validate year range
      if (year < 1900 || year > 2100) {
        return; // Skip invalid year
      }
      
      // For timestamp columns, search the entire day
      const startOfDay = `${cleaned}T00:00:00.000Z`;
      const endOfDay = `${cleaned}T23:59:59.999Z`;
      
      qb.orWhere(`${alias}.${columnName} >= :${parameterName}_dayStart AND ${alias}.${columnName} <= :${parameterName}_dayEnd`, {
        [`${parameterName}_dayStart`]: startOfDay,
        [`${parameterName}_dayEnd`]: endOfDay,
      });
      return;
    }

    // Check if it's an ISO date string (e.g., "2024-01-15T10:30:00Z")
    const isoDate = this.tryParseISODate(cleaned);
    if (isoDate) {
      qb.orWhere(`${alias}.${columnName} = :${parameterName}_iso`, {
        [`${parameterName}_iso`]: isoDate,
      });
      return;
    }

    // Non-date search term - don't apply to date fields
    // This prevents errors like searching "6740" against timestamp columns
  }

  canHandle(searchTerm: string, config: SearchableFieldConfig): boolean {
    // Only handle if the search term looks like a date-related value
    const cleaned = searchTerm.trim();
    
    // Year (4 digits in valid range)
    if (/^\d{4}$/.test(cleaned)) {
      const year = parseInt(cleaned, 10);
      return year >= 1900 && year <= 2100;
    }
    
    // YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(cleaned)) {
      return true;
    }
    
    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return true;
    }
    
    // ISO date string
    if (this.tryParseISODate(cleaned)) {
      return true;
    }
    
    // Not a date-like value - don't handle
    return false;
  }

  private tryParseISODate(value: string): Date | null {
    // Try parsing as ISO date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // Ensure it's actually a date string, not just a number
      if (value.includes('-') || value.includes('/') || value.includes('T')) {
        return date;
      }
    }
    return null;
  }

  private getEndOfMonth(year: number, month: number): string {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  private addDay(dateStr: string): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }
}