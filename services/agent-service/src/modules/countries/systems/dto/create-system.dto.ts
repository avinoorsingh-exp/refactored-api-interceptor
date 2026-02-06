import { ApiProperty } from '@nestjs/swagger'
import type { CreateSystemInput } from '@exprealty/shared-domain'

/**
 * DTO for creating a new System.
 */
export class CreateSystemDto implements CreateSystemInput {
	/**
	 * Currency ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Currency ID to use for the system',
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
}
