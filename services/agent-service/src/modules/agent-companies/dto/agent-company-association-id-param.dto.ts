import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for association ID parameter.
 * Used for OpenAPI documentation.
 */
export class AgentCompanyAssociationIdParamDto {
	@ApiProperty({
		description: 'Association UUID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;
}
