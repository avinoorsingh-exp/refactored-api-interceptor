import { FilterCondition, FilterOperator } from './index.js';
import { OPERATOR_ALIASES } from './constants.js';

/**
 * Parse filter value to appropriate type
 */
export function parseFilterValue(value: string, operator: FilterOperator): any {
  // Handle null values
  if (value === 'null' || value === '') {
    return null;
  }

  // Handle arrays for IN/NIN operators
  if (operator === 'in' || operator === 'nin') {
    return value.split(',').map((v) => parseFilterValue(v.trim(), 'eq'));
  }

  // Handle BETWEEN operator
  if (operator === 'between') {
    const [start, end] = value.split(',');
    return [parseFilterValue(start.trim(), 'eq'), parseFilterValue(end.trim(), 'eq')];
  }

  const lowerValue = value.toLowerCase().trim();
  const TRUE_VALUES = new Set(['true', 'yes', '1', 'y', 't', 'active']);
  const FALSE_VALUES = new Set(['false', 'no', '0', 'n', 'f', 'inactive']);
  
  if (TRUE_VALUES.has(lowerValue)) return true;
  if (FALSE_VALUES.has(lowerValue)) return false;

  // Handle numbers
  if (!isNaN(Number(value)) && value.trim() !== '') {
    return Number(value);
  }

  // Handle dates (ISO format)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Return as string
  return value;
}

/**
 * Normalize operator to canonical form
 */
export function normalizeOperator(operator: string): FilterOperator {
  const normalized = OPERATOR_ALIASES[operator.toLowerCase()];
  if (!normalized) {
    throw new Error(`Unsupported filter operator: ${operator}`);
  }
  return normalized as FilterOperator;
}

/**
 * Parse simple filters from flat query params
 */
export function parseSimpleFilters(
  params: Record<string, any>,
  excludeKeys: string[] = []
): FilterCondition[] {
  const filters: FilterCondition[] = [];

  Object.entries(params).forEach(([key, value]) => {
    if (excludeKeys.includes(key)) return;

    // Parse field[operator] syntax
    const operatorMatch = key.match(/^(.+)\[(.+)\]$/);
    
    if (operatorMatch) {
      const [, field, operatorStr] = operatorMatch;
      const operator = normalizeOperator(operatorStr);
      filters.push({
        field,
        operator,
        value: parseFilterValue(String(value), operator),
      });
    } else {
      // Default to eq operator
      filters.push({
        field: key,
        operator: 'eq' as FilterOperator,
        value: parseFilterValue(String(value), 'eq' as FilterOperator),
      });
    }
  });

  return filters;
}

/**
 * Build query string from query params
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        searchParams.append(key, JSON.stringify(value));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams.toString();
}