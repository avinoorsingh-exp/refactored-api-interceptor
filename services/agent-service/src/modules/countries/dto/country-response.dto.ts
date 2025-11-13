import { ApiProperty } from '@nestjs/swagger'
import type { Country } from '@exprealty/shared-domain'

/**
 * Response DTO for Country entity.
 * Implements shared-domain Country type.
 * Represents the full Country resource after creation.
 */
export class CountryResponseDto implements Country {
	/**
	 * Auto-generated country ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Auto-generated country ID',
		example: 1,
	})
	countryId!: number

	/**
	 * Country name
	 * @example "United States of America"
	 */
	@ApiProperty({
		description: 'Full country name',
		example: 'United States of America',
	})
	name!: string

	/**
	 * ISO 3166-1 alpha-2 code
	 * @example "US"
	 */
	@ApiProperty({
		description: 'ISO 3166-1 alpha-2 code',
		example: 'US',
	})
	alpha2!: string

	/**
	 * ISO 3166-1 alpha-3 code
	 * @example "USA"
	 */
	@ApiProperty({
		description: 'ISO 3166-1 alpha-3 code',
		example: 'USA',
	})
	alpha3!: string

	/**
	 * ISO 3166-1 numeric code
	 * @example 840
	 */
	@ApiProperty({
		description: 'ISO 3166-1 numeric code',
		example: 840,
	})
	number!: number

	/**
	 * International dialing code
	 * @example 1
	 */
	@ApiProperty({
		description: 'International dialing code',
		example: 1,
	})
	dialingCode!: number
}
