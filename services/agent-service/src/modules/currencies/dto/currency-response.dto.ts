import { ApiProperty } from '@nestjs/swagger'
import type { Currency } from '@exprealty/shared-domain'

/**
 * Response DTO for Currency entity.
 * Represents the full Currency resource for REST API.
 */
export class CurrencyResponseDto implements Currency {
	/**
	 * Auto-generated currency ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Auto-generated currency ID',
		example: 1,
	})
	id!: number

	/**
	 * ISO 4217 alpha-3 currency code
	 * @example "USD"
	 */
	@ApiProperty({
		description: 'ISO 4217 alpha-3 currency code',
		example: 'USD',
	})
	code!: string

	/**
	 * ISO 4217 numeric code
	 * @example 840
	 */
	@ApiProperty({
		description: 'ISO 4217 numeric code',
		example: 840,
	})
	number!: number

	/**
	 * Currency name
	 * @example "US Dollar"
	 */
	@ApiProperty({
		description: 'Currency display name',
		example: 'US Dollar',
	})
	name!: string

	/**
	 * Currency symbol
	 * @example "$"
	 */
	@ApiProperty({
		description: 'Currency symbol',
		example: '$',
		required: false,
		nullable: true,
	})
	symbol?: string

	/**
	 * Number of minor units (decimal places)
	 * @example 2
	 */
	@ApiProperty({
		description: 'Number of decimal places',
		example: 2,
	})
	minorUnits!: number

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
