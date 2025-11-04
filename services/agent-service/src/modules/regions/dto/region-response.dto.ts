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
}
