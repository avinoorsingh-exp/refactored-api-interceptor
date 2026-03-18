import { z } from 'zod'

/**
 * Scope for custom flags.
 *
 * @beta
 */
export const CustomFlagScopeSchema = z.enum(['Agent', 'Office', 'Organization', 'Global'])

/**
 * @beta
 */
export type CustomFlagScope = z.infer<typeof CustomFlagScopeSchema>

/**
 * Type for custom flags.
 *
 * @beta
 */
export const CustomFlagTypeSchema = z.enum(['Boolean', 'String', 'Number', 'Date'])

/**
 * @beta
 */
export type CustomFlagType = z.infer<typeof CustomFlagTypeSchema>

/**
 * Base schema for CustomFlag entity.
 *
 * @beta
 */
export const CustomFlagBaseSchema = z
	.object({
		flagId: z.string(),
		name: z.string().min(1).max(255),
		type: CustomFlagTypeSchema,
		scope: CustomFlagScopeSchema,
		active: z.boolean(),
		deleteInProgress: z.boolean().optional(),
	})
	.describe('Base CustomFlag')

/**
 * @beta
 */
export type CustomFlagBase = z.infer<typeof CustomFlagBaseSchema>

/**
 * Expanded schema for CustomFlag entity with relationships.
 *
 * @beta
 */
export const CustomFlagExpandedSchema = CustomFlagBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded CustomFlag with relationships')

/**
 * @beta
 */
export type CustomFlagExpanded = z.infer<typeof CustomFlagExpandedSchema>

/**
 * @beta
 */
export type CustomFlag = CustomFlagExpanded

/**
 * Schema for creating a new CustomFlag.
 *
 * @beta
 */
export const CreateCustomFlagInputSchema = CustomFlagBaseSchema.omit({ flagId: true })

/**
 * @beta
 */
export type CreateCustomFlagInput = z.infer<typeof CreateCustomFlagInputSchema>

/**
 * Schema for updating a CustomFlag.
 *
 * @beta
 */
export const UpdateCustomFlagInputSchema = CustomFlagBaseSchema.omit({
	flagId: true,
}).partial()

/**
 * @beta
 */
export type UpdateCustomFlagInput = z.infer<typeof UpdateCustomFlagInputSchema>
