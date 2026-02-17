import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { 
	CreateAgentTaxInput, 
	UpdateAgentTaxInput, 
	AgentTaxParams,
	TaxIdType,
} from '@exprealty/shared-domain';

/**
 * DTO for creating a new agent tax.
 * Creates both Tax record and AgentTax association.
 */
export class CreateAgentTaxDto implements CreateAgentTaxInput {
	@ApiProperty({
		description: 'Type of tax identifier',
		enum: ['SSN', 'GSN_HST', 'EIN'],
		example: 'SSN',
	})
	taxIdType!: TaxIdType;

	@ApiProperty({
		description: 'Tax ID value (plaintext, write-only — stored as last4 + HMAC token)',
		example: '123-45-6789',
		minLength: 1,
		maxLength: 50,
	})
	value!: string;

	@ApiProperty({
		description: 'Whether this is the primary tax for the agent',
		default: false,
	})
	isPrimary!: boolean;
}

/**
 * DTO for updating an agent tax.
 */
export class UpdateAgentTaxDto implements UpdateAgentTaxInput {
	@ApiPropertyOptional({
		description: 'Updated tax ID value (plaintext, write-only — stored as last4 + HMAC token)',
		example: '987-65-4321',
		minLength: 1,
		maxLength: 50,
	})
	value?: string;

	@ApiPropertyOptional({
		description: 'Whether this is the primary tax for the agent',
	})
	isPrimary?: boolean;
}

/**
 * DTO for agent tax path parameters (agent ID + tax ID).
 */
export class AgentTaxParamsDto implements AgentTaxParams {
	@ApiProperty({
		description: 'Agent UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	id!: string;

	@ApiProperty({
		description: 'Tax UUID',
		format: 'uuid',
		example: '987fcdeb-51a2-3b4c-d567-890123456789',
	})
	taxId!: string;
}

/**
 * Response DTO for Tax entity.
 */
export class TaxResponseDto {
	@ApiProperty({
		description: 'Tax UUID',
		format: 'uuid',
	})
	id!: string;

	@ApiProperty({
		description: 'Type of tax identifier',
		enum: ['SSN', 'GSN_HST', 'EIN'],
	})
	taxIdType!: TaxIdType;

	@ApiProperty({
		description: 'Masked tax ID value (shows last 4 digits)',
		example: '*****6789',
	})
	value!: string;

	@ApiPropertyOptional({
		description: 'HMAC-SHA256 token for secure lookups',
	})
	valueToken?: string;

	@ApiProperty({
		description: 'Creation timestamp',
	})
	created!: Date;

	@ApiProperty({
		description: 'Last modification timestamp',
	})
	lastModified!: Date;

	@ApiProperty({
		description: 'User who last modified the record',
	})
	modifiedBy!: string;
}

/**
 * Response DTO for AgentTax with nested Tax.
 */
export class AgentTaxResponseDto {
	@ApiProperty({
		description: 'AgentTax association UUID',
		format: 'uuid',
	})
	id!: string;

	@ApiProperty({
		description: 'Agent UUID',
		format: 'uuid',
	})
	agentId!: string;

	@ApiProperty({
		description: 'Tax UUID',
		format: 'uuid',
	})
	taxId!: string;

	@ApiProperty({
		description: 'Whether this is the primary tax for the agent',
	})
	isPrimary!: boolean;

	@ApiPropertyOptional({
		description: 'Nested Tax entity',
		type: TaxResponseDto,
	})
	tax?: TaxResponseDto;
}
