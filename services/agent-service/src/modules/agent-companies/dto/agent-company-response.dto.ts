import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for AgentCompany response.
 * Used for OpenAPI documentation.
 */
export class AgentCompanyResponseDto {
	@ApiProperty({
		description: 'Company UUID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;

	@ApiProperty({
		description: 'Legacy system ID',
		example: '12345',
	})
	legacyId!: string;

	@ApiProperty({
		description: 'Company name',
		example: 'Example Brokerage',
	})
	name!: string;

	@ApiProperty({
		description: 'Company email',
		example: 'contact@brokerage.com',
	})
	email!: string;

	@ApiProperty({
		description: 'Company phone number',
		example: '555-123-4567',
	})
	phone!: string;

	@ApiPropertyOptional({
		description: 'Masked tax ID (shows last 4 digits)',
		example: '*****1234',
		nullable: true,
	})
	taxId?: string | null;

	@ApiPropertyOptional({
		description: 'HMAC-SHA256 token for secure lookups',
		nullable: true,
	})
	taxIdToken?: string | null;

	@ApiProperty({
		description: 'Whether the company uses SSN for tax reporting',
		example: false,
	})
	useSsn!: boolean;

	@ApiProperty({
		description: 'Record creation timestamp',
		example: '2024-01-15T10:30:00.000Z',
	})
	createdAt!: Date;

	@ApiProperty({
		description: 'Last modification timestamp',
		example: '2024-01-15T10:30:00.000Z',
	})
	updatedAt!: Date;
}
