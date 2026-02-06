import { ApiProperty } from '@nestjs/swagger'
import type { UpdateSystemInput } from '@exprealty/shared-domain'

/**
 * DTO for updating a System.
 * All fields are optional.
 */
export class UpdateSystemDto implements UpdateSystemInput {
	/**
	 * Currency ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Currency ID to use for the system',
		example: 1,
		required: false,
	})
	currencyId?: number

	/**
	 * System description
	 * @example "US Dollar System"
	 */
	@ApiProperty({
		description: 'System description',
		example: 'US Dollar System',
		required: false,
	})
	description?: string
}
