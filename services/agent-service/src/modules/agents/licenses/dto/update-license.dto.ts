import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating a License.
 * All fields are optional for partial updates.
 * @public
 */
export class UpdateLicenseDto {
	@ApiPropertyOptional({ description: 'License number (unique per agent)', example: 'RE-12345' })
	number?: string;

	@ApiPropertyOptional({ description: 'License type', enum: ['Provisional Broker', 'Broker', 'BIC Eligible'], example: 'Broker' })
	type?: 'Provisional Broker' | 'Broker' | 'BIC Eligible';

	@ApiPropertyOptional({ description: 'Whether this is the primary license', example: true })
	isPrimary?: boolean;

	@ApiPropertyOptional({ description: 'First name on the license', example: 'John' })
	firstName?: string;

	@ApiPropertyOptional({ description: 'Middle name on the license', example: 'Michael' })
	middleName?: string;

	@ApiPropertyOptional({ description: 'Last name on the license', example: 'Doe' })
	lastName?: string;

	@ApiPropertyOptional({ description: 'Name suffix on the license', example: 'Jr' })
	suffix?: string;

	@ApiPropertyOptional({ description: 'License expiration date (ISO 8601)', example: '2025-12-31' })
	expirationDate?: string;

	@ApiPropertyOptional({ description: 'Line of business ID', example: '1' })
	lineOfBusinessId?: string;

	@ApiPropertyOptional({ description: 'Country ID', example: 1 })
	countryId?: number;

	@ApiPropertyOptional({ description: 'Two-letter state code', example: 'CA' })
	stateCode?: string;
}
