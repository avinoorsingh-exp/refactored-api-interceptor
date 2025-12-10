import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new Office.
 * Used for OpenAPI documentation.
 * Audit fields (created, lastModified, modifiedBy) are auto-generated.
 */
export class CreateOfficeDto {
	@ApiPropertyOptional({
		description: 'Office website URL',
		example: 'https://example-office.com',
	})
	website?: string;

	@ApiProperty({
		description: 'Office name',
		example: 'Downtown Branch Office',
		minLength: 1,
		maxLength: 255,
	})
	name!: string;

	@ApiProperty({
		description: 'Office phone number',
		example: '555-123-4567',
		minLength: 1,
		maxLength: 20,
	})
	phone!: string;

	@ApiProperty({
		description: 'Office lifecycle status',
		example: 'active',
		enum: ['new', 'pending_due_diligence', 'pending_payment', 'active', 'withdrawn', 'missing_broker_agent'],
	})
	lifecycleStatus!: string;

	@ApiProperty({
		description: 'Primary state of operation',
		example: 'California',
		minLength: 1,
		maxLength: 200,
	})
	primaryState!: string;

	@ApiProperty({
		description: 'Parent company ID (bigint as string)',
		example: '12345',
	})
	companyId!: string;
}
