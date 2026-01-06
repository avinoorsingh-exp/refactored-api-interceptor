import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an Agent.
 * All fields are optional for partial updates.
 * Used for OpenAPI documentation.
 */
export class UpdateAgentDto {
	@ApiPropertyOptional({
		description: 'Agent title (Mr, Mrs, Ms, Miss)',
		example: 'Mr',
		enum: ['Mr', 'Mrs', 'Ms', 'Miss'],
	})
	title?: string;

	@ApiPropertyOptional({
		description: 'Agent first/given name',
		example: 'John',
		minLength: 2,
		maxLength: 50,
	})
	firstName?: string;

	@ApiPropertyOptional({
		description: 'Agent middle name',
		example: 'Michael',
		minLength: 1,
		maxLength: 50,
	})
	middleName?: string;

	@ApiPropertyOptional({
		description: 'Agent last/family name',
		example: 'Smith',
		minLength: 2,
		maxLength: 50,
	})
	lastName?: string;

	@ApiPropertyOptional({
		description: 'Name suffix (Jr, Sr, II, III, etc.)',
		example: 'Jr',
		enum: ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'Esq'],
	})
	suffix?: string;

	@ApiPropertyOptional({
		description: 'Agent preferred/display name',
		example: 'Johnny',
		minLength: 2,
		maxLength: 50,
	})
	preferredName?: string;

	@ApiPropertyOptional({
		description: 'Agent birth date',
		example: '1985-06-15',
	})
	birthDate?: Date;

	@ApiPropertyOptional({
		description: 'Agent lifecycle status',
		example: 'active',
		enum: ['joining', 'active', 'inactive', 'vested', 'vested retired', 'lead only'],
	})
	lifecycleStatus?: string;

	@ApiPropertyOptional({
		description: 'System ID reference',
		example: 12345,
	})
	systemId?: number;

	@ApiPropertyOptional({
		description: 'Agent company ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
		nullable: true,
	})
	agentCompanyId?: string | null;

	@ApiPropertyOptional({
		description: 'Whether agent is a seed agent',
		example: false,
	})
	seedAgent?: boolean;

	@ApiPropertyOptional({
		description: 'Date when agent joined',
		example: '2020-01-15T00:00:00.000Z',
	})
	joinDate?: Date;

	@ApiPropertyOptional({
		description: 'Agent anniversary date',
		example: '2021-01-15T00:00:00.000Z',
	})
	anniversaryDate?: Date;

	@ApiPropertyOptional({
		description: 'Date when agent was terminated',
		example: null,
	})
	terminationDate?: Date;

	@ApiPropertyOptional({
		description: 'Whether agent is staff',
		example: false,
	})
	isStaff?: boolean;
}
