import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new AgentAddress with inline address creation.
 * Creates both the Address entity and the AgentAddress junction record.
 * @public
 */
export class CreateAgentAddressDto {
	// Junction metadata
	@ApiPropertyOptional({
		description: 'Role/type of address',
		enum: ['home', 'office', 'mailing', 'billing', 'other'],
		example: 'home',
	})
	role?: 'home' | 'office' | 'mailing' | 'billing' | 'other';

	@ApiProperty({ description: 'Whether this is the primary address', example: true })
	isPrimary!: boolean;

	@ApiPropertyOptional({ description: 'Date from which this address is valid (YYYY-MM-DD)', example: '2024-01-01' })
	validFrom?: string;

	@ApiPropertyOptional({ description: 'Date until which this address is valid (YYYY-MM-DD)', example: '2025-12-31' })
	validTo?: string;

	// Address data (inline creation)
	@ApiProperty({ description: 'Address line 1 (street address)', example: '123 Main St' })
	line1!: string;

	@ApiPropertyOptional({ description: 'Address line 2 (apt, suite, etc.)', example: 'Suite 100' })
	line2?: string | null;

	@ApiProperty({ description: 'City name', example: 'Austin' })
	city!: string;

	@ApiProperty({ description: 'Unit/apartment number', example: '101' })
	unit!: string;

	@ApiProperty({ description: 'Postal/ZIP code', example: '78701' })
	postalCode!: string;

	@ApiProperty({ description: 'ISO-3166 alpha-2 country code', example: 'US' })
	country!: string;
}
