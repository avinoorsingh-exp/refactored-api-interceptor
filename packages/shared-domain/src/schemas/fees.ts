import { z } from 'zod'

/**
 * Base schema for Fees entity.
 *
 * @beta
 */
export const FeesBaseSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1).max(255),
		active: z.boolean(),
		value: z.number(),
		paidBy: z.string().max(255).optional(),
		isThirdParty: z.boolean().optional(),
	})
	.describe('Base Fees')

/**
 * @beta
 */
export type FeesBase = z.infer<typeof FeesBaseSchema>

/**
 * Expanded schema for Fees entity with relationships.
 *
 * @beta
 */
export const FeesExpandedSchema = FeesBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded Fees with relationships')

/**
 * @beta
 */
export type FeesExpanded = z.infer<typeof FeesExpandedSchema>

/**
 * @beta
 */
export type Fees = FeesExpanded

/**
 * Schema for creating a new Fees.
 *
 * @beta
 */
export const CreateFeesInputSchema = FeesBaseSchema.omit({ id: true })

/**
 * @beta
 */
export type CreateFeesInput = z.infer<typeof CreateFeesInputSchema>

/**
 * Schema for updating a Fees.
 *
 * @beta
 */
export const UpdateFeesInputSchema = FeesBaseSchema.omit({ id: true }).partial()

/**
 * @beta
 */
export type UpdateFeesInput = z.infer<typeof UpdateFeesInputSchema>
