import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an Agent.
 * All fields are optional for partial updates.
 * Used for OpenAPI documentation.
 */
export class UpdateAgentDto {
	@ApiPropertyOptional({
		description: 'Agent company ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	agentCompanyId?: string;

	@ApiPropertyOptional({
		description: 'Agent first/given name',
		example: 'John',
		minLength: 2,
		maxLength: 50,
	})
	firstName?: string;

	@ApiPropertyOptional({
		description: 'Agent last/family name',
		example: 'Smith',
		minLength: 2,
		maxLength: 50,
	})
	lastName?: string;

	@ApiPropertyOptional({
		description: 'Agent preferred/display name',
		example: 'Johnny',
	})
	preferredName?: string;

	@ApiPropertyOptional({
		description: 'Name suffix (Jr, Sr, II, III, etc.)',
		example: 'Jr',
		enum: ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'Esq'],
	})
	suffix?: string;

	@ApiPropertyOptional({
		description: 'Agent email address',
		example: 'john.smith@example.com',
	})
	email?: string;

	@ApiPropertyOptional({
		description: 'Agent birth date (YYYY-MM-DD)',
		example: '1985-06-15',
	})
	birthDate?: string;
}
