import { z } from 'zod';
/**
 * Cursor-based pagination params
 */
export const CursorPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(), // Base64 encoded cursor
  direction: z.enum(['forward', 'backward']).default('forward'),
});

export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

/**
 * Cursor response metadata (without items)
 */
export const CursorPaginationResponseSchema = z.object({
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
  limit: z.number(),
});

export type CursorPaginationResponse = z.infer<typeof CursorPaginationResponseSchema>;

/**
 * Generic cursor page result with items.
 * Use this for repository/service layer results.
 * 
 * @typeParam T - The item type
 * @typeParam C - The cursor value type (string, number, Date, etc.)
 */
export interface CursorPageResult<T, C = string> {
  items: T[];
  nextCursor: C | null;
  prevCursor: C | null;
  hasNext: boolean;
  hasPrev: boolean;
}