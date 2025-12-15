import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for MLS ID path parameter.
 * Used for OpenAPI documentation.
 */
export class MLSIdParamDto {
	@ApiProperty({
		description: 'MLS ID (bigint as string)',
		example: '12345',
	})
	id!: string;
}
