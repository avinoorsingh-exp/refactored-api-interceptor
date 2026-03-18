
import { z } from 'zod';

/**
 * Sort direction - defined as Zod enum
 */
export const SortDirectionSchema = z
  .enum(['ASC', 'DESC', 'asc', 'desc'])
  .transform((val) => val.toUpperCase() as 'ASC' | 'DESC')
  .default('ASC');

export type SortDirection = z.infer<typeof SortDirectionSchema>;

// Export enum values
export const SortDirectionEnum = {
  ASC: 'ASC' as const,
  DESC: 'DESC' as const,
};

/**
 * Single sort condition
 */
export const SortConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  direction: SortDirectionSchema,
});

export type SortCondition = z.infer<typeof SortConditionSchema>;

/**
 * Complete sort with multiple conditions
 */
export const SortSchema = z.object({
  conditions: z.array(SortConditionSchema).optional().default([]),
});

export type Sort = z.infer<typeof SortSchema>;