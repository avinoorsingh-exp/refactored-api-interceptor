import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for License API response.
 * @public
 */
export class LicenseResponseDto {
	@ApiProperty({ description: 'License UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
	id!: string;

	@ApiProperty({ description: 'Agent UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
	agentId!: string;

	@ApiProperty({ description: 'License number (unique per agent)', example: 'RE-12345' })
	number!: string;

	@ApiProperty({ description: 'License type', enum: ['Provisional Broker', 'Broker', 'BIC Eligible'], example: 'Broker' })
	type!: 'Provisional Broker' | 'Broker' | 'BIC Eligible';

	@ApiProperty({ description: 'Whether this is the primary license', example: true })
	isPrimary!: boolean;

	@ApiProperty({ description: 'First name on the license', example: 'John' })
	firstName!: string;

	@ApiPropertyOptional({ description: 'Middle name on the license', example: 'Michael' })
	middleName?: string;

	@ApiProperty({ description: 'Last name on the license', example: 'Doe' })
	lastName!: string;

	@ApiPropertyOptional({ description: 'Name suffix on the license', example: 'Jr' })
	suffix?: string;

	@ApiPropertyOptional({ description: 'License expiration date (ISO 8601)', example: '2025-12-31' })
	expirationDate?: string;

	@ApiPropertyOptional({ description: 'Line of business ID', example: '1' })
	lineOfBusinessId?: string | null;

	@ApiProperty({ description: 'Country ID', example: 1 })
	countryId!: number;

	@ApiPropertyOptional({ description: 'Two-letter state code', example: 'CA' })
	stateCode?: string;

	@ApiProperty({ description: 'Creation timestamp' })
	created!: Date;

	@ApiProperty({ description: 'Last modification timestamp' })
	lastModified!: Date;

	@ApiProperty({ description: 'User who last modified the record' })
	modifiedBy!: string;
}
