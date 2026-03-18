import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an AgentAddress with optional address updates.
 * All fields are optional for partial updates.
 * Junction only has isPrimary; all other fields update the Address entity.
 * @public
 */
export class UpdateAgentAddressDto {
	// Junction metadata (simplified - only isPrimary)
	@ApiPropertyOptional({ description: 'Whether this is the primary address', example: true })
	isPrimary?: boolean;

	// Address data (optional updates)
	@ApiPropertyOptional({ description: 'Address type (personal, company)', enum: ['personal', 'company'] })
	type?: string | null;

	@ApiPropertyOptional({
		description: 'Address role (contact, bill_to, pay_to, ship_to, return_to)',
		enum: ['contact', 'bill_to', 'pay_to', 'ship_to', 'return_to'],
	})
	role?: string | null;

	@ApiPropertyOptional({ description: 'Address line 1 (street address)', example: '123 Main St' })
	line1?: string;

	@ApiPropertyOptional({ description: 'Address line 2 (apt, suite, etc.)', example: 'Suite 100' })
	line2?: string | null;

	@ApiPropertyOptional({ description: 'City name', example: 'Austin' })
	city?: string;

	@ApiPropertyOptional({ description: 'Unit/apartment number', example: '101' })
	unit?: string | null;

	@ApiPropertyOptional({ description: 'Postal/ZIP code', example: '78701' })
	postalCode?: string;

	@ApiPropertyOptional({ description: 'County name', example: 'Travis' })
	county?: string | null;

	@ApiPropertyOptional({ description: 'Address label for display', example: 'Home Address' })
	label?: string | null;

	@ApiPropertyOptional({ description: 'Foreign key to Country entity', example: 1 })
	countryId?: number;

	@ApiPropertyOptional({ description: 'State/province code (e.g., "CA", "TX")', example: 'TX' })
	stateCode?: string | null;
}
