import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating a PayPlan.
 * All fields are optional for partial updates.
 * Used for OpenAPI documentation.
 */
export class UpdatePayPlanDto {
	@ApiPropertyOptional({
		description: 'Pay plan name',
		example: 'Premium Commission Plan',
		minLength: 1,
		maxLength: 255,
	})
	name?: string;

	@ApiPropertyOptional({
		description: 'Whether the pay plan is active',
		example: true,
	})
	active?: boolean;

	@ApiPropertyOptional({
		description: 'Agent commission percentage',
		example: 85.00,
		minimum: 0,
		maximum: 100,
	})
	agentPercentage?: number;

	@ApiPropertyOptional({
		description: 'Commission cap amount',
		example: 20000.00,
		minimum: 0,
	})
	cap?: number;
}
