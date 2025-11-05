import { z } from 'zod'

/**
 * Base schema for Country entity.
 * Conforms to ISO 3166-1 international standard for country codes.
 *
 * @public
 */
export const CountryBaseSchema = z
	.object({
		countryId: z.number().int().positive(),
		name: z.string().min(1).max(255),
		alpha2: z
			.string()
			.length(2)
			.regex(/^[A-Z]{2}$/, 'Must be 2 uppercase letters'),
		alpha3: z
			.string()
			.length(3)
			.regex(/^[A-Z]{3}$/, 'Must be 3 uppercase letters'),
		number: z.number().int().min(1).max(999),
		dialingCode: z.number().int().positive(),
	})
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
 * Schema for creating a new Country.
 *
 * @public
 */
export const CreateCountryInputSchema = CountryBaseSchema.omit({ countryId: true })

/**
 * @public
 */
export type CreateCountryInput = z.infer<typeof CreateCountryInputSchema>

/**
 * Schema for updating a Country.
 *
 * @public
 */
export const UpdateCountryInputSchema = CountryBaseSchema.omit({
	countryId: true,
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
