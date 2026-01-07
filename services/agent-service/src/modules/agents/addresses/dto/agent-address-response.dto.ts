import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for Address details (the actual address data).
 * @public
 */
export class AddressResponseDto {
	@ApiProperty({ description: 'Unique identifier (BigInt as string)' })
	id!: string;

	@ApiPropertyOptional({ description: 'Address type (personal, company)', enum: ['personal', 'company'] })
	type?: string | null;

	@ApiPropertyOptional({
		description: 'Address role (contact, bill_to, pay_to, ship_to, return_to)',
		enum: ['contact', 'bill_to', 'pay_to', 'ship_to', 'return_to'],
	})
	role?: string | null;

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

	@ApiPropertyOptional({ description: 'Foreign key to State entity (UUID)' })
	stateId?: string | null;

	@ApiProperty({ description: 'Creation timestamp' })
	created!: Date;

	@ApiProperty({ description: 'Last modification timestamp' })
	lastModified!: Date;

	@ApiProperty({ description: 'User/system that last modified the record' })
	modifiedBy!: string;
}

/**
 * Response DTO for AgentAddress junction entity with nested address.
 * Composite key: (agentId, addressId).
 * @public
 */
export class AgentAddressResponseDto {
	@ApiProperty({ description: 'Foreign key to Agent entity (UUID)' })
	agentId!: string;

	@ApiProperty({ description: 'Foreign key to Address entity (BigInt as string)' })
	addressId!: string;

	@ApiProperty({ description: 'Whether this is the primary address', example: true })
	isPrimary!: boolean;

	@ApiPropertyOptional({ description: 'The address details', type: AddressResponseDto })
	address?: AddressResponseDto;
}
