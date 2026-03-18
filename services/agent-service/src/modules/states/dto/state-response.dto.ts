import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for State response.
 * Used for OpenAPI documentation.
 */
export class StateResponseDto {
	@ApiProperty({
		description: 'State UUID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;

	@ApiProperty({
		description: 'State name',
		example: 'Texas',
	})
	name!: string;

	@ApiProperty({
		description: 'State code (abbreviation)',
		example: 'TX',
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
