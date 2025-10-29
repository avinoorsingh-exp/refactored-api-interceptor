import { z } from 'zod'

/**
 * Language code enum.
 *
 * @public
 */
export const LanguageCodeSchema = z.enum(['en-GB', 'ar-SA']).describe('Language code')

/**
 * @public
 */
export type LanguageCode = z.infer<typeof LanguageCodeSchema>

/**
 * Base schema for Language entity.
 *
 * @public
 */
export const LanguageBaseSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(100),
		code: LanguageCodeSchema,
		supported: z.boolean(),
	})
	.describe('Base Language')

/**
 * @public
 */
export type LanguageBase = z.infer<typeof LanguageBaseSchema>

/**
 * Expanded schema for Language entity with relationships.
 *
 * @public
 */
export const LanguageExpandedSchema = LanguageBaseSchema.extend({
	agentLanguages: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Language with relationships')

/**
 * @public
 */
export type LanguageExpanded = z.infer<typeof LanguageExpandedSchema>

/**
 * @public
 */
export type Language = LanguageExpanded

/**
 * Schema for creating a new Language.
 *
 * @public
 */
export const CreateLanguageInputSchema = LanguageBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateLanguageInput = z.infer<typeof CreateLanguageInputSchema>

/**
 * Schema for updating a Language.
 *
 * @public
 */
export const UpdateLanguageInputSchema = LanguageBaseSchema.omit({ id: true }).partial()

/**
 * @public
 */
export type UpdateLanguageInput = z.infer<typeof UpdateLanguageInputSchema>
