import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new State.
 * Used for OpenAPI documentation.
 * Audit fields (created, lastModified, modifiedBy) are auto-generated.
 */
export class CreateStateDto {
	@ApiProperty({
		description: 'State name',
		example: 'Texas',
		minLength: 1,
		maxLength: 255,
	})
	name!: string;

	@ApiProperty({
		description: 'State code (2-letter abbreviation)',
		example: 'TX',
		minLength: 2,
		maxLength: 2,
	})
	code!: string;

	@ApiProperty({
		description: 'Whether the state is active',
		example: true,
	})
	isActive!: boolean;

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

	@ApiProperty({
		description: 'Region ID the state belongs to',
		example: '1',
	})
	regionId!: string;

	@ApiProperty({
		description: 'Country ID the state belongs to',
		example: 3,
	})
	countryId!: number;
}
