import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for state ID path parameter.
 * Used for OpenAPI documentation.
 */
export class StateIdParamDto {
	@ApiProperty({
		description: 'State UUID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;
}
