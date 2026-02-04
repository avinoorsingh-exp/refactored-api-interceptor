import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating an AgentCompany.
 * Used for OpenAPI documentation.
 */
export class CreateAgentCompanyDto {
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
		description: 'Tax ID (will be encrypted)',
		example: '12-3456789',
		nullable: true,
	})
	taxId?: string | null;

	@ApiProperty({
		description: 'Whether the company uses SSN for tax reporting',
		example: false,
		default: false,
	})
	useSsn!: boolean;
}
