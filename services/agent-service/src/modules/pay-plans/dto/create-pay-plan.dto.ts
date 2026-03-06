import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for creating a new PayPlan.
 * Used for OpenAPI documentation.
 * Audit fields (created, lastModified, modifiedBy) are auto-generated.
 */
export class CreatePayPlanDto {
	@ApiProperty({
		description: 'Pay plan name',
		example: 'Standard Commission Plan',
		minLength: 1,
		maxLength: 255,
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
		minimum: 0,
		maximum: 100,
	})
	agentPercentage!: number;

	@ApiProperty({
		description: 'Commission cap amount',
		example: 16000.00,
		minimum: 0,
	})
	cap!: number;
}
