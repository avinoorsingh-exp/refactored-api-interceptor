import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for office ID path parameter.
 * Used for OpenAPI documentation.
 */
export class OfficeIdParamDto {
	@ApiProperty({
		description: 'Office ID (bigint as string)',
		example: '12345',
	})
	id!: string;
}
