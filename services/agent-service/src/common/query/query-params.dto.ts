
import { z } from 'zod';
import { FilterDtoSchema } from './filter.dto.js';
import { SortDtoSchema } from './sort.dto.js';
import { SearchDtoSchema } from './search.dto.js';

export const PaginationDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const QueryParamsDtoSchema = z.object({
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  
  // Filtering (can be JSON string or object)
  filters: z.string().transform((val, ctx) => {
    try {
      return FilterDtoSchema.parse(JSON.parse(val));
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid filters JSON',
      });
      return z.NEVER;
    }
  }).optional(),
  
  // Sorting (can be JSON string or object)
  sort: z.string().transform((val, ctx) => {
    try {
      return SortDtoSchema.parse(JSON.parse(val));
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid sort JSON',
      });
      return z.NEVER;
    }
  }).optional(),
  
  // Search
  search: z.string().optional(),
  searchFields: z.string().transform((val) => val.split(',')).optional(),
});

export type QueryParamsDto = z.infer<typeof QueryParamsDtoSchema>;
export type PaginationDto = z.infer<typeof PaginationDtoSchema>;