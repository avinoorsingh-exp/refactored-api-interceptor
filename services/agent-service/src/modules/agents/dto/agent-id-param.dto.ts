import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for Agent ID path parameter.
 * Used for OpenAPI documentation.
 */
export class AgentIdParamDto {
	@ApiProperty({
		description: 'Agent ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;
}
