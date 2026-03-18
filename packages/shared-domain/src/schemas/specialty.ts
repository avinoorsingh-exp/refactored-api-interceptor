import { z } from 'zod'

/**
 * Base schema for Specialty entity.
 *
 * @public
 */
export const SpecialtyBaseSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1).max(255),
	})
	.describe('Base Specialty')

/**
 * @public
 */
export type SpecialtyBase = z.infer<typeof SpecialtyBaseSchema>

/**
 * Expanded schema for Specialty entity with relationships.
 *
 * @public
 */
export const SpecialtyExpandedSchema = SpecialtyBaseSchema.extend({
	agentSpecialties: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Specialty with relationships')

/**
 * @public
 */
export type SpecialtyExpanded = z.infer<typeof SpecialtyExpandedSchema>

/**
 * @public
 */
export type Specialty = SpecialtyExpanded

/**
 * Schema for creating a new Specialty.
 *
 * @public
 */
export const CreateSpecialtyInputSchema = SpecialtyBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateSpecialtyInput = z.infer<typeof CreateSpecialtyInputSchema>

/**
 * Schema for updating a Specialty.
 *
 * @public
 */
export const UpdateSpecialtyInputSchema = SpecialtyBaseSchema.omit({ id: true }).partial()

/**
 * @public
 */
export type UpdateSpecialtyInput = z.infer<typeof UpdateSpecialtyInputSchema>
