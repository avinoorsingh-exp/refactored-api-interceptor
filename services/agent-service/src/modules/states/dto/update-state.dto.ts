import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating a State.
 * All fields are optional for partial updates.
 * Used for OpenAPI documentation.
 */
export class UpdateStateDto {
	@ApiPropertyOptional({
		description: 'State name',
		example: 'Texas',
		minLength: 1,
		maxLength: 255,
	})
	name?: string;

	@ApiPropertyOptional({
		description: 'State code (abbreviation)',
		example: 'TX',
		maxLength: 10,
	})
	code?: string;

	@ApiPropertyOptional({
		description: 'Whether the state is active',
		example: true,
	})
	isActive?: boolean;

	@ApiPropertyOptional({
		description: 'State contact email',
		example: 'texas@example.com',
	})
	email?: string;

	@ApiPropertyOptional({
		description: 'Signature distribution email',
		example: 'signatures-tx@example.com',
	})
	signatureDistributionEmail?: string;

	@ApiPropertyOptional({
		description: 'Region ID the state belongs to',
		example: '1',
	})
	regionId?: string;

	@ApiPropertyOptional({
		description: 'User who last modified this record',
		example: 'admin',
		maxLength: 255,
	})
	modifiedBy?: string;
}
