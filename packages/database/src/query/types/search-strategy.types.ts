import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { SearchValidator, SearchValidationOptions } from '../../decorators/searchable-decorators.js';

/**
 * Field type for search strategy selection
 */
export enum SearchableFieldType {
  STRING = 'string',
  TEXT = 'text',
  NUMERIC = 'numeric',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  DATE = 'date',
  DATETIME = 'datetime',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
}

/**
 * Search strategy configuration for a field
 */
export interface SearchableFieldConfig {
  // Column name in entity
  field: string;
  
  // Field type (determines search strategy)
  type: SearchableFieldType;
  
  // Optional: Custom search behavior
  searchBehavior?: 'exact' | 'partial' | 'range' | 'prefix' | 'suffix';
  
  // Optional: Boost relevance score (for ranking)
  weight?: number;

  // Optional: Custom validation function for search values
  validate?: SearchValidator;

  // Optional: Validation options for declarative validation
  validationOptions?: SearchValidationOptions;
}

/**
 * Search strategy interface
 * Each field type has its own strategy
 */
export interface ISearchStrategy {
  /**
   * Apply search condition to query builder
   */
  applySearch<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,
    searchTerm: string,
    parameterName: string,
  ): void;

  /**
   * Check if this strategy can handle the search term for this field
   */
  canHandle(searchTerm: string, config: SearchableFieldConfig): boolean;
}
