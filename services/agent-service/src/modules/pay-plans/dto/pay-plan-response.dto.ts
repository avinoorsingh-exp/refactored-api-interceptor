import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for PayPlan response.
 * Used for OpenAPI documentation.
 */
export class PayPlanResponseDto {
	@ApiProperty({
		description: 'Pay plan UUID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;

	@ApiProperty({
		description: 'Pay plan name',
		example: 'Standard Commission Plan',
	})
	name!: string;

	@ApiProperty({
		description: 'Whether the pay plan is active',
		example: true,
	})
	active!: boolean;

	@ApiProperty({
		description: 'Agent commission percentage',
		example: 80.00,
	})
	agentPercentage!: number;

	@ApiProperty({
		description: 'Commission cap amount',
		example: 16000.00,
	})
	cap!: number;

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
