import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { trimmedStringMinMax } from './base-schemas.js'

/**
 * Helper for ISO alpha codes - trims, uppercases, and validates exact length.
 * @internal
 */
const alphaCode = (length: 2 | 3) =>
	z
		.string()
		.transform((val) => val.trim().toUpperCase())
		.pipe(
			z
				.string()
				.length(length, { message: `Must be exactly ${length} characters` })
				.regex(
					length === 2 ? /^[A-Z]{2}$/ : /^[A-Z]{3}$/,
					`Must be ${length} uppercase letters`,
				),
		)

/**
 * Base schema for Country entity.
 * Conforms to ISO 3166-1 international standard for country codes.
 *
 * @public
 */
export const CountryBaseSchema = z
	.object({
		id: z.number().int().positive(),
		name: trimmedStringMinMax(1, 255, 'Country name must be between 1 and 255 characters'),
		alpha2: alphaCode(2).describe('ISO 3166-1 alpha-2 code (e.g., US, CA)'),
		alpha3: alphaCode(3).describe('ISO 3166-1 alpha-3 code (e.g., USA, CAN)'),
		number: z.number().int().min(1).max(999),
		dialingCode: z.number().int().positive(),
	})
	.merge(AuditableSchema)
	.describe('Base Country (ISO 3166-1)')

/**
 * @public
 */
export type CountryBase = z.infer<typeof CountryBaseSchema>

/**
 * Expanded schema for Country entity with relationships.
 *
 * @public
 */
export const CountryExpandedSchema = CountryBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded Country with relationships')

/**
 * @public
 */
export type CountryExpanded = z.infer<typeof CountryExpandedSchema>

/**
 * @public
 */
export type Country = CountryExpanded

/**
 * API Response type for Country with snake_case audit fields.
 * This represents the REST API contract.
 * 
 * @public
 */
export type CountryApiResponse = Omit<Country, 'created' | 'lastModified' | 'modifiedBy'> & {
	created: string
	last_modified: string
	modified_by: string
}

/**
 * Schema for creating a new Country.
 * Omits auto-generated fields (id, audit fields).
 *
 * @public
 */
export const CreateCountryInputSchema = CountryBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
})

/**
 * @public
 */
export type CreateCountryInput = z.infer<typeof CreateCountryInputSchema>

/**
 * Schema for updating a Country.
 * Omits auto-generated/immutable fields (id, audit fields).
 *
 * @public
 */
export const UpdateCountryInputSchema = CountryBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
}).partial()

/**
 * @public
 */
export type UpdateCountryInput = z.infer<typeof UpdateCountryInputSchema>

/**
 * Schema for validating country code path parameter.
 * Accepts only alpha-2 code (2 uppercase letters).
 *
 * @public
 */
export const CountryCodeParamSchema = z
	.object({
		code: CountryBaseSchema.shape.alpha2,
	})
	.describe('Country code path parameter')

/**
 * @public
 */
export type CountryCodeParam = z.infer<typeof CountryCodeParamSchema>
