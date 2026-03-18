import { ApiProperty } from '@nestjs/swagger'
import type { LineOfBusiness } from '@exprealty/shared-domain'

/**
 * Response DTO for LineOfBusiness entity.
 * Represents the full LineOfBusiness resource for REST API.
 */
export class LineOfBusinessResponseDto implements Omit<LineOfBusiness, 'licenses' | 'mxid'> {
	/**
	 * Auto-generated line of business ID (bigint as string)
	 * @example "1"
	 */
	@ApiProperty({
		description: 'Auto-generated line of business ID (bigint as string)',
		example: '1',
	})
	id!: string

	/**
	 * Line of business name
	 * @example "residential"
	 */
	@ApiProperty({
		description: 'Line of business name',
		example: 'residential',
	})
	name!: string

	/**
	 * Timestamp when the record was created
	 * @example "2024-01-15T10:30:00.000Z"
	 */
	@ApiProperty({
		description: 'Timestamp when the record was created',
		example: '2024-01-15T10:30:00.000Z',
	})
	created!: Date

	/**
	 * Timestamp when the record was last modified
	 * @example "2024-01-15T10:30:00.000Z"
	 */
	@ApiProperty({
		description: 'Timestamp when the record was last modified',
		example: '2024-01-15T10:30:00.000Z',
	})
	lastModified!: Date

	/**
	 * User or system that last modified the record
	 * @example "system"
	 */
	@ApiProperty({
		description: 'User or system that last modified the record',
		example: 'system',
	})
	modifiedBy!: string
}
