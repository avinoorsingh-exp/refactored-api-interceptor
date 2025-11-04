import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for updating an existing Region.
 */
export class UpdateRegionDto {
	/**
	 * The unique name of the region
	 */
	@ApiProperty({
		description: 'The unique name of the region',
		example: 'Pacific Northwest',
		minLength: 1,
		maxLength: 255,
	})
	name!: string
}
