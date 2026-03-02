import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for ExternalReference entity.
 * @public
 */
export class ExternalReferenceResponseDto {
	@ApiProperty({ description: 'Unique identifier (UUID)' })
	id!: string;

	@ApiProperty({ description: "External system identifier (e.g., 'SALESFORCE')" })
	systemCode!: string;

	@ApiProperty({ description: 'Reference key/type in external system' })
	refKey!: string;

	@ApiProperty({ description: 'Reference value/ID in external system' })
	refValue!: string;

	@ApiProperty({ description: 'User who created the reference', default: 'system' })
	createdBy!: string;

	@ApiProperty({ description: 'Creation timestamp' })
	created!: Date;

	@ApiProperty({ description: 'Last modification timestamp' })
	lastModified!: Date;

	@ApiPropertyOptional({ description: 'User who last modified the record' })
	modifiedBy?: string;
}
