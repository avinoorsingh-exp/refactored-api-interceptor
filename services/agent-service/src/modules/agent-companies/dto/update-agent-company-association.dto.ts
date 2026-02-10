import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating an AgentCompanyAssociation.
 * Used for OpenAPI documentation.
 */
export class UpdateAgentCompanyAssociationDto {
	@ApiProperty({
		description: 'Whether this is the primary company for the agent',
		example: true,
	})
	isPrimary!: boolean;
}
