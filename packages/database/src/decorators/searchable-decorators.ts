import 'reflect-metadata';

const SEARCHABLE_FIELDS_KEY = Symbol('searchableFields');
const SEARCHABLE_CONFIG_KEY = Symbol('searchableConfig');
const FILTERABLE_FIELDS_KEY = Symbol('filterableFields');
const FILTERABLE_CONFIG_KEY = Symbol('filterableConfig');
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

/**
 * All supported filter operators
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'nin'
  | 'between'
  | 'isNull'
  | 'isNotNull'
  | 'startsWith'
  | 'endsWith'
  | 'contains';

/**
 * All available filter operators (permissive default)
 */
export const ALL_FILTER_OPERATORS: FilterOperator[] = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'in', 'nin', 'between',
  'isNull', 'isNotNull', 'startsWith', 'endsWith', 'contains',
];

/**
 * Validation options for filterable fields
 */
export interface FilterValidationOptions {
  /**
   * Minimum value (for numeric fields)
   */
  min?: number;

  /**
   * Maximum value (for numeric fields)
   */
  max?: number;

  /**
   * Regex pattern validation
   */
  pattern?: RegExp | string;
}

/**
 * Options for @Filterable decorator
 * Business-level constraints - what operators are allowed and validation rules
 */
export interface FilterableOptions {
  /**
   * Allowed operators for this field.
   * If not specified, all operators are allowed (permissive default).
   */
  operators?: FilterOperator[];

  /**
   * Validation rules for filter values
   */
  validation?: FilterValidationOptions;
}

/**
 * Stored filterable field configuration
 */
export interface FilterableFieldConfig {
  field: string;
  operators?: FilterOperator[];
  validation?: FilterValidationOptions;
}

export function Filterable(options: FilterableOptions = {}) {
  return function (target: any, propertyKey: string) {
    // Store in simple array for backward compatibility (getFilterableFields)
    const existingFields = Reflect.getMetadata(FILTERABLE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      FILTERABLE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor
    );

    // Store in Map with options for advanced usage (getFilterableFieldsConfig)
    const existingConfig: Map<string, FilterableOptions> =
      Reflect.getMetadata(FILTERABLE_CONFIG_KEY, target.constructor) || new Map();
    existingConfig.set(propertyKey, options);
    Reflect.defineMetadata(FILTERABLE_CONFIG_KEY, existingConfig, target.constructor);
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
  // Try multiple locations where metadata might be stored
  let fields = Reflect.getMetadata(SEARCHABLE_FIELDS_KEY, target);
  if (!fields || fields.length === 0) {
    fields = Reflect.getMetadata(SEARCHABLE_FIELDS_KEY, target.prototype);
  }
  if (!fields || fields.length === 0) {
    fields = Reflect.getMetadata(SEARCHABLE_FIELDS_KEY, target.constructor);
  }
  return fields || [];
}

/**
 * Get searchable fields with their configuration options
 * @returns Map of property names to their SearchableOptions
 */
export function getSearchableFieldsConfig(target: any): Map<string, SearchableOptions> {
  // The decorator stores on target.constructor where target is the prototype
  // When we pass the class directly, metadata is on the class itself
  // So check the class first, then prototype.constructor (which is also the class)
  
  // Try the class directly first (this is where the decorator stores it)
  let config = Reflect.getMetadata(SEARCHABLE_CONFIG_KEY, target);
  // If target is a class and has prototype, check if metadata is on prototype.constructor
  // (The decorator stores on prototype.constructor, which is the class when target is the class)
  if ((!config || config.size === 0) && target && target.prototype) {
    const prototypeConstructor = target.prototype.constructor;
    if (prototypeConstructor && prototypeConstructor !== Object && prototypeConstructor === target) {
      // prototype.constructor is the class itself, check it
      config = Reflect.getMetadata(SEARCHABLE_CONFIG_KEY, prototypeConstructor); 
    }
    // Also check prototype itself
    if ((!config || config.size === 0)) {
      config = Reflect.getMetadata(SEARCHABLE_CONFIG_KEY, target.prototype);  
    }
  }
  // If still not found, try target.constructor (for cases where target is an instance)
  if ((!config || config.size === 0) && target && target.constructor && 
      target.constructor !== Object && target.constructor !== target) {
    config = Reflect.getMetadata(SEARCHABLE_CONFIG_KEY, target.constructor);
  }
  const result = config || new Map();
  return result;
}

/**
 * Get filterable field names, traversing the inheritance chain
 * @returns Array of property names marked with @Filterable from this class and parent classes
 */
export function getFilterableFields(target: any): string[] {
  const fields = new Set<string>();
  
  // Get the class constructor (decorators store metadata on constructor)
  let cls: any;
  if (typeof target === 'function') {
    cls = target; // It's a class constructor
  } else if (target && target.constructor && typeof target.constructor === 'function') {
    cls = target.constructor; // It's an instance or prototype
  } else {
    // Fallback: return empty array if we can't determine the class
    return [];
  }
  
  // Traverse up the inheritance chain
  let currentClass = cls;
  while (currentClass && currentClass !== Object && currentClass !== Function.prototype) {
    // Get fields from this class constructor (where decorators store metadata)
    const classFields = Reflect.getMetadata(FILTERABLE_FIELDS_KEY, currentClass) || [];
    classFields.forEach((field: string) => fields.add(field));
    
    // Move to parent class
    currentClass = Object.getPrototypeOf(currentClass);
  }
  
  return Array.from(fields);
}

/**
 * Get filterable fields with their configuration options, traversing the inheritance chain
 * @returns Map of property names to their FilterableOptions from this class and parent classes
 */
export function getFilterableFieldsConfig(target: any): Map<string, FilterableOptions> {
  const config = new Map<string, FilterableOptions>();
  
  // Get the class constructor (decorators store metadata on constructor)
  let cls: any;
  if (typeof target === 'function') {
    cls = target; // It's a class constructor
  } else if (target && target.constructor && typeof target.constructor === 'function') {
    cls = target.constructor; // It's an instance or prototype
  } else {
    // Fallback: return empty map if we can't determine the class
    return new Map();
  }
  
  // Traverse up the inheritance chain (parent classes first, then child classes)
  // This way child class config overrides parent class config
  const classChain: any[] = [];
  let currentClass = cls;
  while (currentClass && currentClass !== Object && currentClass !== Function.prototype) {
    classChain.push(currentClass);
    currentClass = Object.getPrototypeOf(currentClass);
  }
  
  // Process from parent to child (so child overrides parent)
  classChain.reverse().forEach((currentClass) => {
    const classConfig = Reflect.getMetadata(FILTERABLE_CONFIG_KEY, currentClass) || new Map();
    classConfig.forEach((value: FilterableOptions, key: string) => {
      // Child class config overrides parent class config
      config.set(key, value);
    });
  });
  
  return config;
}

/**
 * Get sortable field names, traversing the inheritance chain
 * @returns Array of property names marked with @Sortable from this class and parent classes
 */
export function getSortableFields(target: any): string[] {
  const fields = new Set<string>();
  
  // Get the class constructor (decorators store metadata on constructor)
  let cls: any;
  if (typeof target === 'function') {
    cls = target; // It's a class constructor
  } else if (target && target.constructor && typeof target.constructor === 'function') {
    cls = target.constructor; // It's an instance or prototype
  } else {
    // Fallback: return empty array if we can't determine the class
    return [];
  }
  
  // Traverse up the inheritance chain
  let currentClass = cls;
  while (currentClass && currentClass !== Object && currentClass !== Function.prototype) {
    // Get fields from this class constructor (where decorators store metadata)
    const classFields = Reflect.getMetadata(SORTABLE_FIELDS_KEY, currentClass) || [];
    classFields.forEach((field: string) => fields.add(field));
    
    // Move to parent class
    currentClass = Object.getPrototypeOf(currentClass);
  }
  
  return Array.from(fields);
}