import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new ExternalReference.
 * @public
 */
export class CreateExternalReferenceDto {
	@ApiProperty({ description: "External system identifier (e.g., 'SALESFORCE', 'LEGACY_CRM')", example: 'SALESFORCE' })
	systemCode!: string;

	@ApiProperty({ description: 'Reference key/type in external system', example: 'AccountId' })
	refKey!: string;

	@ApiProperty({ description: 'Reference value/ID in external system', example: '001D000000IqhSLIAZ' })
	refValue!: string;

	@ApiPropertyOptional({ description: 'User who created the reference (defaults to system)', default: 'system' })
	createdBy?: string;
}
