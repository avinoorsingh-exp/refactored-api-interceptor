import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an AgentAddress with optional address updates.
 * All fields are optional for partial updates.
 * @public
 */
export class UpdateAgentAddressDto {
	// Junction metadata (optional)
	@ApiPropertyOptional({
		description: 'Role/type of address',
		enum: ['home', 'office', 'mailing', 'billing', 'other'],
		example: 'home',
	})
	role?: 'home' | 'office' | 'mailing' | 'billing' | 'other';

	@ApiPropertyOptional({ description: 'Whether this is the primary address', example: true })
	isPrimary?: boolean;

	@ApiPropertyOptional({ description: 'Date from which this address is valid (YYYY-MM-DD)', example: '2024-01-01' })
	validFrom?: string;

	@ApiPropertyOptional({ description: 'Date until which this address is valid (YYYY-MM-DD)', example: '2025-12-31' })
	validTo?: string;

	// Address data (optional updates)
	@ApiPropertyOptional({ description: 'Address line 1 (street address)', example: '123 Main St' })
	line1?: string;

	@ApiPropertyOptional({ description: 'Address line 2 (apt, suite, etc.)', example: 'Suite 100' })
	line2?: string | null;

	@ApiPropertyOptional({ description: 'City name', example: 'Austin' })
	city?: string;

	@ApiPropertyOptional({ description: 'Unit/apartment number', example: '101' })
	unit?: string;

	@ApiPropertyOptional({ description: 'Postal/ZIP code', example: '78701' })
	postalCode?: string;

	@ApiPropertyOptional({ description: 'ISO-3166 alpha-2 country code', example: 'US' })
	country?: string;
}
