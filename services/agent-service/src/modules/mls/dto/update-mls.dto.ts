import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an MLS.
 * Used for OpenAPI documentation.
 * All fields are optional for partial updates.
 */
export class UpdateMLSDto {
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

	@ApiPropertyOptional({
		description: 'MLS lifecycle status',
		example: 'active',
		enum: ['active', 'archived', 'missing_broker_agent', 'closed', 'in_build', 'pending', 'unknown'],
	})
	lifecycleStatus?: string;

	@ApiPropertyOptional({
		description: 'MLS name',
		example: 'Multiple Listing Service of Greater Metro',
		minLength: 1,
		maxLength: 255,
	})
	name?: string;

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

	@ApiPropertyOptional({
		description: 'MLS organization type',
		example: 'mls',
		enum: ['association', 'mls', 'commercial', 'unknown', 'technology_company'],
	})
	orgType?: string;

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
}
