import { z } from 'zod'

/**
 * Base schema for Region entity.
 *
 * @public
 */
export const RegionBaseSchema = z
	.object({
		id: z
			.string()
			.regex(/^\d+$/, { message: 'errors.region.id.invalid' })
			.describe('Primary key (bigint as string)'),
		name: z.string().min(1).max(255),
	})
	.describe('Base Region')

/**
 * @public
 */
export type RegionBase = z.infer<typeof RegionBaseSchema>

/**
 * Expanded schema for Region entity with relationships.
 *
 * @public
 */
export const RegionExpandedSchema = RegionBaseSchema.extend({
	states: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Region with relationships')

/**
 * @public
 */
export type RegionExpanded = z.infer<typeof RegionExpandedSchema>

/**
 * @public
 */
export type Region = RegionExpanded

/**
 * Schema for creating a new Region.
 * Adds trimming and length validation.
 *
 * @public
 */
export const CreateRegionInputSchema = RegionBaseSchema.omit({ id: true }).extend({
	name: z.string().trim().min(1, 'Name is required').max(255),
})

/**
 * @public
 */
export type CreateRegionInput = z.infer<typeof CreateRegionInputSchema>

/**
 * Schema for updating a Region.
 * Adds trimming and length validation.
 *
 * @public
 */
export const UpdateRegionInputSchema = RegionBaseSchema.omit({ id: true }).extend({
	name: z.string().trim().min(1, 'Name is required').max(255),
})

/**
 * @public
 */
export type UpdateRegionInput = z.infer<typeof UpdateRegionInputSchema>

/**
 * Zod schema for validating region id path parameter.
 * Reuses validation from RegionBaseSchema.shape.id.
 *
 * @public
 */
export const RegionIdParamSchema = z.object({
	id: RegionBaseSchema.shape.id,
})

/**
 * TypeScript type for region id path parameter.
 *
 * @public
 */
export type RegionIdParam = z.infer<typeof RegionIdParamSchema>
