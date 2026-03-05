import { z } from 'zod'

/**
 * Base schema for LineOfBusiness entity.
 *
 * @public
 */
export const LineOfBusinessBaseSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1).max(255),
	})
	.describe('Base LineOfBusiness')

/**
 * @public
 */
export type LineOfBusinessBase = z.infer<typeof LineOfBusinessBaseSchema>

/**
 * Expanded schema for LineOfBusiness entity with relationships.
 *
 * @public
 */
export const LineOfBusinessExpandedSchema = LineOfBusinessBaseSchema.extend({
	licenses: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded LineOfBusiness with relationships')

/**
 * @public
 */
export type LineOfBusinessExpanded = z.infer<typeof LineOfBusinessExpandedSchema>

/**
 * @public
 */
export type LineOfBusiness = LineOfBusinessExpanded

/**
 * Schema for creating a new LineOfBusiness.
 *
 * @public
 */
export const CreateLineOfBusinessInputSchema = LineOfBusinessBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateLineOfBusinessInput = z.infer<typeof CreateLineOfBusinessInputSchema>

/**
 * Schema for updating a LineOfBusiness.
 *
 * @public
 */
export const UpdateLineOfBusinessInputSchema = LineOfBusinessBaseSchema.omit({
	id: true,
}).partial()

/**
 * @public
 */
export type UpdateLineOfBusinessInput = z.infer<typeof UpdateLineOfBusinessInputSchema>
