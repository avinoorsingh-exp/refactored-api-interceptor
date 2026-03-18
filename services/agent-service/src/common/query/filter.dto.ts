
import { z } from 'zod';
import { 
  FilterOperatorSchema, 
  LogicalOperatorSchema,
  LogicalOperatorEnum,
  type FilterOperator, 
  type LogicalOperator 
} from '@exprealty/shared-domain';

export const FilterConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  operator: FilterOperatorSchema,
  value: z.any(), // Will be validated against entity schema
});

export const FilterDtoSchema = z.object({
  conditions: z.array(FilterConditionSchema).optional(),
  logicalOperator: LogicalOperatorSchema,
});

export type FilterDto = z.infer<typeof FilterDtoSchema>;
export type FilterConditionDto = z.infer<typeof FilterConditionSchema>;