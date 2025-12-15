
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
 * Validation result from a search validator
 */
export interface SearchValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: any; // Sanitized/transformed value
}

/**
 * Validator function type for search values
 */
export type SearchValidator = (
  value: any,
  field: string,
  fieldType: string,
) => SearchValidationResult;

/**
 * Search validation options
 */
export interface SearchValidationOptions {
  /**
   * Minimum value (for numeric/date fields)
   */
  min?: number | Date;

  /**
   * Maximum value (for numeric/date fields)
   */
  max?: number | Date;

  /**
   * Minimum length (for string fields)
   */
  minLength?: number;

  /**
   * Maximum length (for string fields)
   */
  maxLength?: number;

  /**
   * Regex pattern validation
   */
  pattern?: RegExp;

  /**
   * Allowed values (enum)
   */
  enum?: any[];

  /**
   * Custom validator function
   */
  custom?: SearchValidator;

  /**
   * Transform value before validation
   */
  transform?: (value: any) => any;

  /**
   * Custom error message
   */
  errorMessage?: string;
}

/**
 * Built-in validators for common numeric ranges
 */
export const SearchValidators = {
  /**
   * Validates that a numeric value is within PostgreSQL integer range (-2147483648 to 2147483647)
   */
  integer: (value: any, field: string, fieldType: string): SearchValidationResult => {
    const strValue = String(value);
    const num = parseFloat(strValue.replace(/[$,]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000'));
    if (isNaN(num)) return { valid: true }; // Let non-numeric pass through for text search
    const INT_MIN = -2147483648;
    const INT_MAX = 2147483647;
    if (num < INT_MIN || num > INT_MAX) {
      return { valid: false, error: `Value ${value} is out of range for integer (${INT_MIN} to ${INT_MAX})` };
    }
    return { valid: true, sanitized: num };
  },

  /**
   * Validates that a numeric value is within PostgreSQL bigint range
   */
  bigint: (value: any, field: string, fieldType: string): SearchValidationResult => {
    const strValue = String(value);
    const num = parseFloat(strValue.replace(/[$,]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000'));
    if (isNaN(num)) return { valid: true }; // Let non-numeric pass through for text search
    const BIGINT_MIN = -9223372036854775808;
    const BIGINT_MAX = 9223372036854775807;
    if (num < BIGINT_MIN || num > BIGINT_MAX) {
      return { valid: false, error: `Value ${value} is out of range for bigint (${BIGINT_MIN} to ${BIGINT_MAX})` };
    }
    return { valid: true, sanitized: num };
  },

  /**
   * Validates that a numeric value is positive
   */
  positive: (value: any, field: string, fieldType: string): SearchValidationResult => {
    const strValue = String(value);
    const num = parseFloat(strValue.replace(/[$,]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000'));
    if (isNaN(num)) return { valid: true };
    if (num < 0) {
      return { valid: false, error: `Value ${value} must be positive` };
    }
    return { valid: true, sanitized: num };
  },

  /**
   * Creates a custom range validator
   */
  range: (min: number, max: number): SearchValidator => (value: any, field: string, fieldType: string): SearchValidationResult => {
    const strValue = String(value);
    const num = parseFloat(strValue.replace(/[$,]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000'));
    if (isNaN(num)) return { valid: true };
    if (num < min || num > max) {
      return { valid: false, error: `Value ${value} is out of range (${min} to ${max})` };
    }
    return { valid: true, sanitized: num };
  },

  /**
   * Creates a validator from SearchValidationOptions
   */
  fromOptions: (options: SearchValidationOptions): SearchValidator => (value: any, field: string, fieldType: string): SearchValidationResult => {
    let processedValue = value;

    // Apply transform if provided
    if (options.transform) {
      processedValue = options.transform(value);
    }

    // Check enum
    if (options.enum && !options.enum.includes(processedValue)) {
      return { 
        valid: false, 
        error: options.errorMessage || `Value ${value} must be one of: ${options.enum.join(', ')}` 
      };
    }

    // Check pattern
    if (options.pattern && !options.pattern.test(String(processedValue))) {
      return { 
        valid: false, 
        error: options.errorMessage || `Value ${value} does not match required pattern` 
      };
    }

    // String length checks
    const strValue = String(processedValue);
    if (options.minLength !== undefined && strValue.length < options.minLength) {
      return { 
        valid: false, 
        error: options.errorMessage || `Value must be at least ${options.minLength} characters` 
      };
    }
    if (options.maxLength !== undefined && strValue.length > options.maxLength) {
      return { 
        valid: false, 
        error: options.errorMessage || `Value must be at most ${options.maxLength} characters` 
      };
    }

    // Numeric range checks
    const num = parseFloat(strValue.replace(/[$,]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000'));
    if (!isNaN(num)) {
      if (options.min !== undefined && num < (options.min as number)) {
        return { 
          valid: false, 
          error: options.errorMessage || `Value ${value} must be at least ${options.min}` 
        };
      }
      if (options.max !== undefined && num > (options.max as number)) {
        return { 
          valid: false, 
          error: options.errorMessage || `Value ${value} must be at most ${options.max}` 
        };
      }
    }

    // Custom validator
    if (options.custom) {
      return options.custom(processedValue, field, fieldType);
    }

    return { valid: true, sanitized: processedValue };
  },
};

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

  /**
   * Validator function for search values
   * Use SearchValidators for common validations
   */
  validate?: SearchValidator;
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