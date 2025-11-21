/**
 * Default values for query parameters
 */
export const DEFAULT_QUERY_PARAMS = {
  OFFSET: 0,
  LIMIT: 10,
  MAX_LIMIT: 100,
  LOGICAL_OPERATOR: 'AND' as const,
  SORT_DIRECTION: 'ASC' as const,
} as const;

/**
 * Reserved query parameter keys that should not be treated as filters
 */
export const RESERVED_QUERY_KEYS = [
  'offset',
  'limit',
  'page',
  'pageSize',
  'sort',
  'order',
  'orderBy',
  'q',
  'query',
  'search',
  'searchFields',
  'fields',
  'include',
  'exclude',
  'filter',
] as const;

/**
 * Operator mappings for different naming conventions
 */
export const OPERATOR_ALIASES: Record<string, string> = {
  // Comparison
  'eq': 'eq',
  'equals': 'eq',
  '=': 'eq',
  
  'ne': 'ne',
  'notEquals': 'ne',
  '!=': 'ne',
  '<>': 'ne',
  
  'gt': 'gt',
  'greaterThan': 'gt',
  '>': 'gt',
  
  'gte': 'gte',
  'greaterThanOrEqual': 'gte',
  '>=': 'gte',
  
  'lt': 'lt',
  'lessThan': 'lt',
  '<': 'lt',
  
  'lte': 'lte',
  'lessThanOrEqual': 'lte',
  '<=': 'lte',
  
  // Pattern matching
  'like': 'like',
  'ilike': 'ilike',
  'contains': 'ilike',
  'startsWith': 'startsWith',
  'endsWith': 'endsWith',
  
  // Arrays
  'in': 'in',
  'nin': 'nin',
  'notIn': 'nin',
  
  // Range
  'between': 'between',
  
  // Null checks
  'isNull': 'isNull',
  'null': 'isNull',
  'isNotNull': 'isNotNull',
  'notNull': 'isNotNull',
} as const;