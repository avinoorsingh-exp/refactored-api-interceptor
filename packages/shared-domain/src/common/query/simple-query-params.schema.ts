
import { z } from 'zod';
import { NormalizedPaginationSchema } from '../paging.js';
import { FilterOperatorSchema } from './filter.schema.js';
import { SortDirectionSchema } from './sort.schema.js';

/**
 * Alternative: Simpler query params using flat structure
 * Better for human-readable URLs and REST API conventions
 * 
 * Example URLs:
 * ?offset=0&limit=10&status=COMPLETED&amount[gte]=1000&sort=-createdAt&q=john&searchFields=name,email
 */
export const SimpleQueryParamsSchema = NormalizedPaginationSchema.extend({
  // Simple sorting: comma-separated fields with optional minus prefix for DESC
  // Example: sort=-createdAt,name
  sort: z.string()
    .transform((val) => {
      const conditions = val.split(',').map((field) => {
        const isDesc = field.startsWith('-');
        return {
          field: isDesc ? field.slice(1) : field,
          direction: (isDesc ? 'DESC' : 'ASC') as 'ASC' | 'DESC',
        };
      });
      return { conditions };
    })
    .optional(),

  // Simple search: q parameter with comma-separated search fields
  // Example: q=john&searchFields=name,email
  q: z.string().optional(),
  searchFields: z.string()
    .transform((val) => val.split(',').filter(Boolean))
    .optional(),
}).passthrough(); // Allow dynamic filter fields

export type SimpleQueryParams = z.infer<typeof SimpleQueryParamsSchema>;

/**
 * Helper to parse dynamic filter fields from query params
 * Example: { status: 'COMPLETED', 'amount[gte]': '1000' }
 * Becomes: [{ field: 'status', operator: 'eq', value: 'COMPLETED' }, { field: 'amount', operator: 'gte', value: 1000 }]
 */
// export function parseSimpleFilters(
//   params: Record<string, any>,
//   excludeKeys: string[] = ['offset', 'limit', 'sort', 'q', 'searchFields']
// ): Array<{ field: string; operator: string; value: any }> {
//   const filters: Array<{ field: string; operator: string; value: any }> = [];

//   Object.entries(params).forEach(([key, value]) => {
//     if (excludeKeys.includes(key)) return;

//     // Check for operator syntax: field[operator]
//     const match = key.match(/^(\w+)\[(\w+)\]$/);
    
//     if (match) {
//       const [, field, operator] = match;
//       filters.push({ field, operator, value });
//     } else {
//       // Default to 'eq' operator
//       filters.push({ field: key, operator: 'eq', value });
//     }
//   });

//   return filters;
// }