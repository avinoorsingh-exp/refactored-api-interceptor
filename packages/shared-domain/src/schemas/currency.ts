import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { trimmedStringMinMax } from './base-schemas.js'

/**
 * Helper for ISO 4217 alpha-3 currency code - trims, uppercases, and validates exact length.
 * @internal
 */
const currencyCode = () =>
	z
		.string()
		.transform((val) => val.trim().toUpperCase())
		.pipe(
			z
				.string()
				.length(3, { message: 'Must be exactly 3 characters' })
				.regex(/^[A-Z]{3}$/, 'Must be 3 uppercase letters'),
		)

/**
 * Base schema for Currency entity.
 * Conforms to ISO 4217 international standard for currency codes.
 *
 * @public
 */
export const CurrencyBaseSchema = z
	.object({
		id: z.number().int().positive(),
		code: currencyCode().describe('ISO 4217 alpha-3 code (e.g., USD, EUR)'),
		number: z.number().int().min(0).max(999).describe('ISO 4217 numeric code (e.g., 840, 978)'),
		name: trimmedStringMinMax(1, 100, 'Currency name must be between 1 and 100 characters'),
		symbol: z.string().max(10).optional().nullable(),
		minorUnits: z.number().int().min(0).max(4).default(2),
	})
	.merge(AuditableSchema)
	.describe('Base Currency (ISO 4217)')

/**
 * @public
 */
export type CurrencyBase = z.infer<typeof CurrencyBaseSchema>

/**
 * Expanded schema for Currency entity with relationships.
 *
 * @public
 */
export const CurrencyExpandedSchema = CurrencyBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded Currency with relationships')

/**
 * @public
 */
export type CurrencyExpanded = z.infer<typeof CurrencyExpandedSchema>

/**
 * @public
 */
export type Currency = CurrencyExpanded

/**
 * API Response type for Currency with snake_case audit fields.
 * This represents the REST API contract.
 *
 * @public
 */
export type CurrencyApiResponse = Omit<Currency, 'created' | 'lastModified' | 'modifiedBy'> & {
	created: string
	last_modified: string
	modified_by: string
}

/**
 * Schema for creating a new Currency.
 * Omits auto-generated fields (id, audit fields).
 *
 * @public
 */
export const CreateCurrencyInputSchema = CurrencyBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	mxid: true,
})

/**
 * @public
 */
export type CreateCurrencyInput = z.infer<typeof CreateCurrencyInputSchema>

/**
 * Schema for updating a Currency.
 * Omits auto-generated/immutable fields (id, audit fields).
 *
 * @public
 */
export const UpdateCurrencyInputSchema = CurrencyBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	mxid: true,
}).partial()

/**
 * @public
 */
export type UpdateCurrencyInput = z.infer<typeof UpdateCurrencyInputSchema>

/**
 * Schema for validating currency ID path parameter.
 *
 * @public
 */
export const CurrencyIdParamSchema = z
	.object({
		id: z.coerce.number().int().positive(),
	})
	.describe('Currency ID path parameter')

/**
 * @public
 */
export type CurrencyIdParam = z.infer<typeof CurrencyIdParamSchema>
