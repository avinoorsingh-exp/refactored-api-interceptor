import { z } from 'zod';

/**
 * Filter operators - defined as Zod enum
 */
export const FilterOperatorSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'in',
  'nin',
  'between',
  'isNull',
  'isNotNull',
  'contains',
  'startsWith',
  'endsWith',
]);

// Export the TypeScript type
export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

// Export enum values for programmatic access
export const FilterOperatorEnum = FilterOperatorSchema.enum;

/**
 * Logical operators - define base enum first, then apply default
 */
const LogicalOperatorBaseSchema = z.enum(['AND', 'OR']);

// Export enum values BEFORE applying .default()
export const LogicalOperatorEnum = LogicalOperatorBaseSchema.enum;

// Export schema with default for validation
export const LogicalOperatorSchema = LogicalOperatorBaseSchema.default('AND');

// Export the TypeScript type
export type LogicalOperator = z.infer<typeof LogicalOperatorBaseSchema>;

/**
 * Single filter condition
 */
export const FilterConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  operator: FilterOperatorSchema,
  value: z.any(),
});

export type FilterCondition = z.infer<typeof FilterConditionSchema>;

/**
 * Complete filter with multiple conditions
 */
export const FilterSchema = z.object({
  conditions: z.array(FilterConditionSchema).optional().default([]),
  logicalOperator: LogicalOperatorSchema,
});

export type Filter = z.infer<typeof FilterSchema>;