import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an AgentCompany.
 * Used for OpenAPI documentation.
 */
export class UpdateAgentCompanyDto {
	@ApiPropertyOptional({
		description: 'Company name',
		example: 'Updated Brokerage Name',
	})
	name?: string;

	@ApiPropertyOptional({
		description: 'Company email',
		example: 'newcontact@brokerage.com',
	})
	email?: string;

	@ApiPropertyOptional({
		description: 'Company phone number',
		example: '555-987-6543',
	})
	phone?: string;

	@ApiPropertyOptional({
		description: 'Tax ID (will be encrypted)',
		example: '12-3456789',
		nullable: true,
	})
	taxId?: string | null;

	@ApiPropertyOptional({
		description: 'Whether the company uses SSN for tax reporting',
		example: false,
	})
	useSsn?: boolean;
}
