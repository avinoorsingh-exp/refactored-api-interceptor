import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for region ID path parameter.
 */
export class RegionIdParamDto {
	/**
	 * Region ID (bigint as string)
	 */
	@ApiProperty({
		description: 'Region ID (bigint as string)',
		example: '1',
		type: 'string',
		pattern: '^\\d+$',
	})
	id!: string
}
