
import { z } from 'zod';

export const SearchDtoSchema = z.object({
  query: z.string().min(1, 'Search query is required').optional(),
  fields: z.array(z.string()).min(1, 'At least one search field is required').optional(),
});

export type SearchDto = z.infer<typeof SearchDtoSchema>;