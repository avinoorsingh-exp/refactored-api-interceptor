import { ApiProperty } from '@nestjs/swagger'
import type { CreateCountryInput } from '@exprealty/shared-domain'

/**
 * DTO for creating a new Country.
 * Implements shared-domain CreateCountryInput type.
 * Validation is handled by ZodValidationPipe using CreateCountryInputSchema.
 * This class exists primarily for Swagger API documentation.
 */
export class CreateCountryDto implements CreateCountryInput {
	/**
	 * Country name (e.g., "United States of America", "Canada")
	 * @example "United States of America"
	 */
	@ApiProperty({
		description: 'Full country name',
		minLength: 1,
		maxLength: 255,
		example: 'United States of America',
	})
	name!: string

	/**
	 * ISO 3166-1 alpha-2 code (2 uppercase letters)
	 * @example "US"
	 */
	@ApiProperty({
		description: 'ISO 3166-1 alpha-2 code (2 uppercase letters)',
		pattern: '^[A-Z]{2}$',
		example: 'US',
	})
	alpha2!: string

	/**
	 * ISO 3166-1 alpha-3 code (3 uppercase letters)
	 * @example "USA"
	 */
	@ApiProperty({
		description: 'ISO 3166-1 alpha-3 code (3 uppercase letters)',
		pattern: '^[A-Z]{3}$',
		example: 'USA',
	})
	alpha3!: string

	/**
	 * ISO 3166-1 numeric code (1-999)
	 * @example 840
	 */
	@ApiProperty({
		description: 'ISO 3166-1 numeric code',
		minimum: 1,
		maximum: 999,
		example: 840,
	})
	number!: number

	/**
	 * International dialing code
	 * @example 1
	 */
	@ApiProperty({
		description: 'International dialing code',
		minimum: 1,
		example: 1,
		required: true,
	})
	dialingCode!: number
}
