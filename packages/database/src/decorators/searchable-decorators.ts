
import 'reflect-metadata';

const SEARCHABLE_FIELDS_KEY = Symbol('searchableFields');
const SEARCHABLE_CONFIG_KEY = Symbol('searchableConfig');
const FILTERABLE_FIELDS_KEY = Symbol('filterableFields');
const SORTABLE_FIELDS_KEY = Symbol('sortableFields');

/**
 * Searchable field type for metadata
 */
export type SearchableFieldType = 'string' | 'text' | 'numeric' | 'integer' | 'decimal' | 'date' | 'datetime' | 'boolean';

/**
 * Searchable decorator options for advanced search configuration
 */
export interface SearchableOptions {
  /**
   * Search weight for relevance ranking (1-10)
   * Higher weight = more important field
   * @default 5
   */
  weight?: number;

  /**
   * Search behavior override
   * If not specified, inferred from column type
   * @default 'partial' for strings, 'exact' for others
   */
  behavior?: 'exact' | 'partial' | 'range' | 'prefix' | 'suffix';

  /**
   * Custom field type override
   * If not specified, inferred from TypeORM column type
   */
  type?: SearchableFieldType;

  /**
   * Human-readable field description for metadata/documentation
   */
  description?: string;
}

/**
 * Marks a property as searchable.
 * Can be used with or without options for backward compatibility.
 * 
 * @example
 * // Simple usage (backward compatible)
 * @Searchable()
 * name: string;
 * 
 * // Advanced usage with options
 * @Searchable({ weight: 10, type: 'numeric' })
 * listPrice: number;
 */
export function Searchable(options: SearchableOptions = {}) {
  return function (target: any, propertyKey: string) {
    // Store in simple array for backward compatibility (getSearchableFields)
    const existingFields = Reflect.getMetadata(SEARCHABLE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      SEARCHABLE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor
    );

    // Also store in Map with options for advanced usage (getSearchableFieldsConfig)
    const existingConfig: Map<string, SearchableOptions> =
      Reflect.getMetadata(SEARCHABLE_CONFIG_KEY, target.constructor) || new Map();
    existingConfig.set(propertyKey, options);
    Reflect.defineMetadata(SEARCHABLE_CONFIG_KEY, existingConfig, target.constructor);
  };
}

export function Filterable() {
  return function (target: any, propertyKey: string) {
    const existingFields = Reflect.getMetadata(FILTERABLE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      FILTERABLE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor
    );
  };
}

export function Sortable() {
  return function (target: any, propertyKey: string) {
    const existingFields = Reflect.getMetadata(SORTABLE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      SORTABLE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor
    );
  };
}

/**
 * Get searchable field names (backward compatible)
 * @returns Array of property names marked with @Searchable
 */
export function getSearchableFields(target: any): string[] {
  return Reflect.getMetadata(SEARCHABLE_FIELDS_KEY, target) || [];
}

/**
 * Get searchable fields with their configuration options
 * @returns Map of property names to their SearchableOptions
 */
export function getSearchableFieldsConfig(target: any): Map<string, SearchableOptions> {
  return Reflect.getMetadata(SEARCHABLE_CONFIG_KEY, target) || new Map();
}

export function getFilterableFields(target: any): string[] {
  return Reflect.getMetadata(FILTERABLE_FIELDS_KEY, target) || [];
}

export function getSortableFields(target: any): string[] {
  return Reflect.getMetadata(SORTABLE_FIELDS_KEY, target) || [];
}