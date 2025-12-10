import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for Office response.
 * Used for OpenAPI documentation.
 */
export class OfficeResponseDto {
	@ApiProperty({
		description: 'Office ID (bigint as string)',
		example: '12345',
	})
	id!: string;

	@ApiPropertyOptional({
		description: 'Office website URL',
		example: 'https://example-office.com',
	})
	website?: string;

	@ApiProperty({
		description: 'Office name',
		example: 'Downtown Branch Office',
	})
	name!: string;

	@ApiProperty({
		description: 'Office phone number',
		example: '555-123-4567',
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
	})
	primaryState!: string;

	@ApiProperty({
		description: 'Parent company ID (bigint as string)',
		example: '12345',
	})
	companyId!: string;

	@ApiProperty({
		description: 'Record creation timestamp',
		example: '2024-01-15T10:30:00.000Z',
	})
	created!: Date;

	@ApiProperty({
		description: 'Last modification timestamp',
		example: '2024-01-15T10:30:00.000Z',
	})
	lastModified!: Date;

	@ApiProperty({
		description: 'User who last modified this record',
		example: 'admin',
	})
	modifiedBy!: string;
}
