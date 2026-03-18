
import { z } from 'zod';
import { PaginationQuerySchema } from '../paging.js';
import { FilterSchema } from './filter.schema.js';
import { SortSchema } from './sort.schema.js';
import { SearchSchema } from './search.schema.js';

export const QueryParamsSchema = PaginationQuerySchema.extend({
  // Filter - accepts JSON string from query params OR already-parsed array (from Postman)
  // Accepts both direct array format and {conditions: [...], logicalOperator: '...'} format
  filter: z
    .union([z.string(), z.array(z.any()), z.object({ conditions: z.array(z.any()), logicalOperator: z.string().optional() })])
    .transform((val, ctx) => {
      if (!val) return undefined;
      
      // If already an object with conditions (correct format)
      if (typeof val === 'object' && !Array.isArray(val) && 'conditions' in val) {
        try {
          return FilterSchema.parse(val);
        } catch (e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid filter format',
          });
          return z.NEVER;
        }
      }
      
      // If direct array (shorthand from Postman), wrap it with default AND operator
      if (Array.isArray(val)) {
        try {
          return FilterSchema.parse({ conditions: val, logicalOperator: 'AND' });
        } catch (e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid filter format',
          });
          return z.NEVER;
        }
      }
      
      // If string, parse JSON first
      if (typeof val === 'string') {
        if (val.trim() === '') return undefined;
        try {
          const parsed = JSON.parse(val);
          // If parsed to array, wrap it with AND operator; if object, use as-is
          const normalized = Array.isArray(parsed) 
            ? { conditions: parsed, logicalOperator: 'AND' } 
            : parsed;
          return FilterSchema.parse(normalized);
        } catch (e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid filter format. Expected JSON array: [{"field":"fieldName","operator":"eq|ne|gt|gte|lt|lte|like|in","value":"..."}]',
          });
          return z.NEVER;
        }
      }

      return undefined;
    })
    .optional(),

  // Sort - accepts JSON string from query params OR already-parsed array (from Postman)
  // Accepts both direct array format and {conditions: [...]} format
  sort: z
    .union([z.string(), z.array(z.any()), z.object({ conditions: z.array(z.any()) })])
    .transform((val, ctx) => {
      if (!val) return undefined;
      
      // If already an object with conditions (correct format)
      if (typeof val === 'object' && !Array.isArray(val) && 'conditions' in val) {
        try {
          return SortSchema.parse(val);
        } catch (e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid sort format',
          });
          return z.NEVER;
        }
      }
      
      // If direct array (shorthand from Postman), wrap it
      if (Array.isArray(val)) {
        try {
          return SortSchema.parse({ conditions: val });
        } catch (e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid sort format',
          });
          return z.NEVER;
        }
      }
      
      // If string, parse JSON first
      if (typeof val === 'string') {
        if (val.trim() === '') return undefined;
        try {
          const parsed = JSON.parse(val);
          // If parsed to array, wrap it; if object, use as-is
          const normalized = Array.isArray(parsed) ? { conditions: parsed } : parsed;
          return SortSchema.parse(normalized);
        } catch (e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid sort format. Expected JSON array: [{"field":"fieldName","direction":"ASC|DESC"}]',
          });
          return z.NEVER;
        }
      }
      
      return undefined;
    })
    .optional(),

  // Search - simple string search
  search: z.string().min(1).optional(),
  
  // Search fields - comma-separated list
  searchFields: z
    .string()
    .transform((val) => val.split(',').map((f) => f.trim()).filter(Boolean))
    .optional(),
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;

/**
 * Normalized query params after parsing
 * Includes your existing NormalizedPagination
 */
export const NormalizedQueryParamsSchema = z.object({
  // Your existing pagination
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),

  // Extended query capabilities
  filter: FilterSchema.optional(),
  sort: SortSchema.optional(),
  search: z
    .object({
      query: z.string(),
      fields: z.array(z.string()),
    })
    .optional(),
});

export type NormalizedQueryParams = z.infer<typeof NormalizedQueryParamsSchema>;
