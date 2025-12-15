import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new Agent.
 * Used for OpenAPI documentation.
 * Audit fields (created, lastModified, modifiedBy) are auto-generated.
 */
export class CreateAgentDto {
	@ApiProperty({
		description: 'Agent company ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	agentCompanyId!: string;

	@ApiProperty({
		description: 'Agent first/given name',
		example: 'John',
		minLength: 2,
		maxLength: 50,
	})
	firstName!: string;

	@ApiProperty({
		description: 'Agent last/family name',
		example: 'Smith',
		minLength: 2,
		maxLength: 50,
	})
	lastName!: string;

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

	@ApiProperty({
		description: 'Agent email address',
		example: 'john.smith@example.com',
	})
	email!: string;

	@ApiProperty({
		description: 'Agent birth date (YYYY-MM-DD)',
		example: '1985-06-15',
	})
	birthDate!: string;
}
