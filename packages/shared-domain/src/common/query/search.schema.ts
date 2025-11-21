
import { z } from 'zod';

/**
 * Search configuration
 */
export const SearchSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').optional(),
  fields: z.array(z.string().min(1)).min(1, 'At least one search field required').optional(),
});

export type Search = z.infer<typeof SearchSchema>;