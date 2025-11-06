import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for region response.
 * Used for API responses.
 */
export class RegionResponseDto {
	@ApiProperty({
		description: 'Region ID',
		example: '1',
	})
	id!: string

	@ApiProperty({
		description: 'Region name',
		example: 'Pacific Northwest',
	})
	name!: string

	@ApiProperty({
		description: 'Timestamp when the region was created',
		example: '2024-01-15T08:30:00.000Z',
		type: String,
	})
	created_at!: string

	@ApiProperty({
		description: 'Timestamp when the region was last updated',
		example: '2024-01-20T14:45:00.000Z',
		type: String,
	})
	updated_at!: string
}
