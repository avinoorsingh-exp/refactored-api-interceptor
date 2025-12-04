import { z } from 'zod';

export const FieldSelectionSchema = z.object({
  fields: z
    .string()
    .transform((val) => val.split(',').map((f) => f.trim()))
    .optional(),
  include: z
    .string()
    .transform((val) => val.split(',').map((r) => r.trim()))
    .optional(),
});

export type FieldSelection = z.infer<typeof FieldSelectionSchema>;

/**
 * Projection configuration for an entity
 */
export interface ProjectionConfig {
  // Always included (e.g., primary keys)
  required: string[];
  
  // Allowed for selection
  allowed: string[];
  
  // Default if no ?fields specified
  default: string[];
  
  // Available relations
  relations: Record<string, {
    property: string;
    fields: string[];
  }>;
}