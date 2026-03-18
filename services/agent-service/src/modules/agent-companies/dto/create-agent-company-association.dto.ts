import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for creating an AgentCompanyAssociation.
 * Used for OpenAPI documentation.
 */
export class CreateAgentCompanyAssociationDto {
	@ApiProperty({
		description: 'Agent Company UUID to associate with',
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	})
	agentCompanyId!: string;

	@ApiProperty({
		description: 'Whether this is the primary company for the agent',
		example: false,
		required: false,
		default: false,
	})
	isPrimary?: boolean;
}
