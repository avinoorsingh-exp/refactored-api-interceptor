import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new AgentAddress with inline address creation.
 * Creates both the Address entity and the AgentAddress junction record.
 * Junction only has isPrimary; all other fields go to Address entity.
 * @public
 */
export class CreateAgentAddressDto {
	// Junction metadata (simplified - only isPrimary)
	@ApiProperty({ description: 'Whether this is the primary address', example: true })
	isPrimary!: boolean;

	// Address data (inline creation)
	@ApiPropertyOptional({ description: 'Address type (personal, company)', enum: ['personal', 'company'] })
	type?: string;

	@ApiPropertyOptional({
		description: 'Address role (contact, bill_to, pay_to, ship_to, return_to)',
		enum: ['contact', 'bill_to', 'pay_to', 'ship_to', 'return_to'],
	})
	role?: string;

	@ApiProperty({ description: 'Address line 1 (street address)', example: '123 Main St' })
	line1!: string;

	@ApiPropertyOptional({ description: 'Address line 2 (apt, suite, etc.)', example: 'Suite 100' })
	line2?: string | null;

	@ApiProperty({ description: 'City name', example: 'Austin' })
	city!: string;

	@ApiPropertyOptional({ description: 'Unit/apartment number', example: '101' })
	unit?: string | null;

	@ApiProperty({ description: 'Postal/ZIP code', example: '78701' })
	postalCode!: string;

	@ApiPropertyOptional({ description: 'County name', example: 'Travis' })
	county?: string | null;

	@ApiPropertyOptional({ description: 'Address label for display', example: 'Home Address' })
	label?: string | null;

	@ApiProperty({ description: 'Foreign key to Country entity', example: 1 })
	countryId!: number;

	@ApiPropertyOptional({ description: 'State/province code (e.g., "CA", "TX")', example: 'TX' })
	stateCode?: string | null;
}
