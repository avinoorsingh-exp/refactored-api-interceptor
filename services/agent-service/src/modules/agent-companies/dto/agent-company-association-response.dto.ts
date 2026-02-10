import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for AgentCompanyAssociation response.
 * Used for OpenAPI documentation.
 */
export class AgentCompanyAssociationResponseDto {
	@ApiProperty({
		description: 'Association UUID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;

	@ApiProperty({
		description: 'Agent UUID',
		example: '70d049b4-4780-4e4f-9a7b-469d600b2d38',
	})
	agentId!: string;

	@ApiProperty({
		description: 'Agent Company UUID',
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	})
	agentCompanyId!: string;

	@ApiProperty({
		description: 'Whether this is the primary company for the agent',
		example: true,
	})
	isPrimary!: boolean;
}
