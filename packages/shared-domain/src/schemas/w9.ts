import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Federal tax classification for W9 forms.
 *
 * @public
 */
export const FederalTaxClassificationSchema = z.enum([
	'Individual/sole proprietor or single-member LLC',
	'C Corporation',
	'S Corporation',
	'Partnership',
	'Trust/estate',
	'Limited liability company',
	'Other',
])

/**
 * @public
 */
export type FederalTaxClassification = z.infer<typeof FederalTaxClassificationSchema>

/**
 * Base schema for W9 entity.
 *
 * @public
 */
export const W9BaseSchema = z
	.object({
		id: z.string().uuid(),
		tin: z.string().max(20),
		legalName: z.string().max(255),
		businessName: z.string().max(255).optional(),
		federalTaxClassification: FederalTaxClassificationSchema,
		federalTaxClassificationOther: z.string().max(255).optional(),
		exemptPayeeCode: z.string().max(50).optional(),
		exemptionFromFatcaReportingCode: z.string().max(50).optional(),
		signatureDate: InstantUTC,
		createdAt: InstantUTC,
		updatedAt: InstantUTC,
	})
	.describe('Base W9')

/**
 * @public
 */
export type W9Base = z.infer<typeof W9BaseSchema>

/**
 * Expanded schema for W9 entity with relationships.
 *
 * @public
 */
export const W9ExpandedSchema = W9BaseSchema.extend({
	w9Addresses: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded W9 with relationships')

/**
 * @public
 */
export type W9Expanded = z.infer<typeof W9ExpandedSchema>

/**
 * @public
 */
export type W9 = W9Expanded

/**
 * Schema for creating a new W9.
 *
 * @public
 */
export const CreateW9InputSchema = W9BaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

/**
 * @public
 */
export type CreateW9Input = z.infer<typeof CreateW9InputSchema>

/**
 * Schema for updating a W9.
 *
 * @public
 */
export const UpdateW9InputSchema = W9BaseSchema.omit({
	id: true,
	createdAt: true,
}).partial()

/**
 * @public
 */
export type UpdateW9Input = z.infer<typeof UpdateW9InputSchema>
