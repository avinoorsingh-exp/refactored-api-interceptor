
import { z } from 'zod';
import { SortDirectionSchema, SortDirectionEnum } from '@exprealty/shared-domain';

export const SortConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  direction: SortDirectionSchema,
});

export const SortDtoSchema = z.object({
  sort: z.array(SortConditionSchema).optional(),
});

export type SortDto = z.infer<typeof SortDtoSchema>;
export type SortConditionDto = z.infer<typeof SortConditionSchema>;