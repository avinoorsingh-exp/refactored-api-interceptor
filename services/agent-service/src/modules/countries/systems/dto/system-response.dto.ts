import { ApiProperty } from '@nestjs/swagger'
import type { System } from '@exprealty/shared-domain'

/**
 * Response DTO for System entity.
 * Represents the full System resource for REST API.
 */
export class SystemResponseDto implements System {
	/**
	 * Auto-generated system ID
	 * @example "1"
	 */
	@ApiProperty({
		description: 'Auto-generated system ID',
		example: '1',
	})
	id!: string

	/**
	 * Country ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Country ID the system belongs to',
		example: 1,
	})
	countryId!: number

	/**
	 * Currency ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Currency ID used by the system',
		example: 1,
	})
	currencyId!: number

	/**
	 * System description
	 * @example "US Dollar System"
	 */
	@ApiProperty({
		description: 'System description',
		example: 'US Dollar System',
	})
	description!: string

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
