import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Base schema for Tax entity.
 *
 * @public
 */
export const TaxBaseSchema = z
	.object({
		id: z.string().uuid(),
		taxId: z.string().max(50),
		type: z.string().max(100),
		jurisdiction: z.string().max(255),
		rate: z.number().optional(),
		effectiveDate: InstantUTC.optional(),
		expirationDate: InstantUTC.optional(),
	})
	.describe('Base Tax')

/**
 * @public
 */
export type TaxBase = z.infer<typeof TaxBaseSchema>

/**
 * Expanded schema for Tax entity with relationships.
 *
 * @public
 */
export const TaxExpandedSchema = TaxBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded Tax with relationships')

/**
 * @public
 */
export type TaxExpanded = z.infer<typeof TaxExpandedSchema>

/**
 * @public
 */
export type Tax = TaxExpanded

/**
 * Schema for creating a new Tax.
 *
 * @public
 */
export const CreateTaxInputSchema = TaxBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateTaxInput = z.infer<typeof CreateTaxInputSchema>

/**
 * Schema for updating a Tax.
 *
 * @public
 */
export const UpdateTaxInputSchema = TaxBaseSchema.omit({ id: true }).partial()

/**
 * @public
 */
export type UpdateTaxInput = z.infer<typeof UpdateTaxInputSchema>
