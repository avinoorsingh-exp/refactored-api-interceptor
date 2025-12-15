import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for MLS response.
 * Used for OpenAPI documentation.
 */
export class MLSResponseDto {
	@ApiProperty({
		description: 'MLS ID (bigint as string)',
		example: '12345',
	})
	id!: string;

	@ApiPropertyOptional({
		description: 'Organization unique identifier',
		example: 'mls-org-123',
	})
	ouid?: string;

	@ApiPropertyOptional({
		description: 'Global ID for the MLS',
		example: 12345,
	})
	globalId?: number;

	@ApiProperty({
		description: 'MLS lifecycle status',
		example: 'active',
		enum: ['active', 'archived', 'missing_broker_agent', 'closed', 'in_build', 'pending', 'unknown'],
	})
	lifecycleStatus!: string;

	@ApiProperty({
		description: 'MLS name',
		example: 'Multiple Listing Service of Greater Metro',
	})
	name!: string;

	@ApiPropertyOptional({
		description: 'MLS short name',
		example: 'Metro MLS',
	})
	shortName?: string;

	@ApiPropertyOptional({
		description: 'MLS website URL',
		example: 'https://metromls.example.com',
	})
	website?: string;

	@ApiProperty({
		description: 'MLS organization type',
		example: 'mls',
		enum: ['association', 'mls', 'commercial', 'unknown', 'technology_company'],
	})
	orgType!: string;

	@ApiPropertyOptional({
		description: 'Kunversion URL',
		example: 'https://kunversion.example.com/mls',
	})
	kunversionUrl?: string;

	@ApiPropertyOptional({
		description: 'Address ID (bigint as string)',
		example: '12345',
	})
	addressId?: string;

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
