import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an Office.
 * All fields are optional for partial updates.
 * Used for OpenAPI documentation.
 */
export class UpdateOfficeDto {
	@ApiPropertyOptional({
		description: 'Office website URL',
		example: 'https://updated-office.com',
	})
	website?: string;

	@ApiPropertyOptional({
		description: 'Office name',
		example: 'Updated Branch Office',
		minLength: 1,
		maxLength: 255,
	})
	name?: string;

	@ApiPropertyOptional({
		description: 'Office phone number',
		example: '555-987-6543',
		minLength: 1,
		maxLength: 20,
	})
	phone?: string;

	@ApiPropertyOptional({
		description: 'Office lifecycle status',
		example: 'active',
		enum: ['new', 'pending_due_diligence', 'pending_payment', 'active', 'withdrawn', 'missing_broker_agent'],
	})
	lifecycleStatus?: string;

	@ApiPropertyOptional({
		description: 'Primary state of operation',
		example: 'Texas',
		minLength: 1,
		maxLength: 200,
	})
	primaryState?: string;

	@ApiPropertyOptional({
		description: 'Parent company ID (bigint as string)',
		example: '67890',
	})
	companyId?: string;
}
