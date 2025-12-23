import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for Address details (the actual address data).
 * @public
 */
export class AddressResponseDto {
	@ApiProperty({ description: 'Unique identifier (UUID)' })
	id!: string;

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

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt!: Date;

	@ApiProperty({ description: 'Last modification timestamp' })
	updatedAt!: Date;
}

/**
 * Response DTO for AgentAddress junction entity with nested address.
 * @public
 */
export class AgentAddressResponseDto {
	@ApiProperty({ description: 'Unique identifier (UUID)' })
	id!: string;

	@ApiProperty({ description: 'Foreign key to Agent entity' })
	agentId!: string;

	@ApiProperty({ description: 'Foreign key to Address entity' })
	addressId!: string;

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

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt!: Date;

	@ApiProperty({ description: 'Last modification timestamp' })
	updatedAt!: Date;

	@ApiPropertyOptional({ description: 'The address details', type: AddressResponseDto })
	address?: AddressResponseDto;
}
