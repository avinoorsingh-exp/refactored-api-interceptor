import { z } from 'zod'

/**
 * Base schema for Country entity.
 *
 * @public
 */
export const CountryBaseSchema = z
	.object({
		countryId: z.string(),
		name: z.string().min(1).max(255),
		twoLetterCode: z.string().length(2),
		iso3166: z.string().max(50).optional(),
		dialingCode: z.number().int().optional(),
		systemId: z.number().int().optional(),
	})
	.describe('Base Country')

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
