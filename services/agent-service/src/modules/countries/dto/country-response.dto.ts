import { ApiProperty } from '@nestjs/swagger'
import type { Country } from '@exprealty/shared-domain'

/**
 * Response DTO for Country entity.
 * Represents the full Country resource with snake_case audit fields for REST API.
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
	id!: number

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

	/**
	 * Timestamp when record was created
	 */
	@ApiProperty({
		description: 'Timestamp when record was created',
		example: '2024-01-15T10:30:00Z',
	})
	created!: Date

	/**
	 * Timestamp when record was last modified
	 */
	@ApiProperty({
		description: 'Timestamp when record was last modified',
		example: '2024-01-15T14:45:00Z',
	})
	lastModified!: Date

	/**
	 * User/system identifier who last modified the record
	 */
	@ApiProperty({
		description: 'User/system identifier who last modified the record',
		example: 'system',
	})
	modifiedBy!: string
}
