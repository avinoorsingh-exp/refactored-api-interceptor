import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an ExternalReference. All fields optional (partial update).
 * @public
 */
export class UpdateExternalReferenceDto {
	@ApiPropertyOptional({ description: "External system identifier", example: 'SALESFORCE' })
	systemCode?: string;

	@ApiPropertyOptional({ description: 'Reference key/type', example: 'AccountId' })
	refKey?: string;

	@ApiPropertyOptional({ description: 'Reference value/ID', example: '001D000000IqhSLIAZ' })
	refValue?: string;

	@ApiPropertyOptional({ description: 'User who last modified the reference' })
	modifiedBy?: string;
}
