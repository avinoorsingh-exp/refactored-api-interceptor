import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for Agent response.
 * Used for OpenAPI documentation.
 */
export class AgentResponseDto {
	@ApiProperty({
		description: 'Agent ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;

	@ApiPropertyOptional({
		description: 'Legacy agent ID (bigint as string)',
		example: '123456789',
	})
	agentId?: string;

	@ApiPropertyOptional({
		description: 'Agent title (Mr, Mrs, Ms, Miss)',
		example: 'Mr',
	})
	title?: string;

	@ApiProperty({
		description: 'Agent first/given name',
		example: 'John',
	})
	firstName!: string;

	@ApiPropertyOptional({
		description: 'Agent middle name',
		example: 'Michael',
	})
	middleName?: string;

	@ApiProperty({
		description: 'Agent last/family name',
		example: 'Smith',
	})
	lastName!: string;

	@ApiPropertyOptional({
		description: 'Name suffix',
		example: 'Jr',
	})
	suffix?: string;

	@ApiPropertyOptional({
		description: 'Agent preferred/display name',
		example: 'Johnny',
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

	@ApiPropertyOptional({
		description: 'Agent company ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
		nullable: true,
	})
	agentCompanyId?: string | null;

	@ApiProperty({
		description: 'Record creation timestamp',
		example: '2024-01-15T10:30:00.000Z',
	})
	created!: Date;

	@ApiProperty({
		description: 'Record last modification timestamp',
		example: '2024-01-15T14:45:00.000Z',
	})
	lastModified!: Date;

	@ApiProperty({
		description: 'User who last modified the record',
		example: 'user@example.com',
	})
	modifiedBy!: string;
}
