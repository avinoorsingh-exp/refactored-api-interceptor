import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isMaskedPlaceholder } from '@exprealty/shared-domain';
import type { FieldEncryptionService } from '@exprealty/encryption';
import type { IAgentTaxRepository } from './ports/agent-tax.repository.port.js';
import type {
	CreateAgentTaxInput,
	UpdateAgentTaxInput,
	AgentTax,
	QueryParams,
} from '@exprealty/shared-domain';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Application service for managing AgentTax aggregate.
 * Handles business logic and orchestrates domain operations.
 *
 * Depends on IAgentTaxRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class AgentTaxService {
	constructor(
		@Inject('IAgentTaxRepository')
		private readonly repository: IAgentTaxRepository,
		@Inject('FIELD_ENCRYPTION')
		private readonly encryption: FieldEncryptionService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(AgentTaxService.name);
	}

	/**
	 * Compute encrypted fields from a raw tax ID value.
	 * Rejects masked placeholders (e.g. "*****6789") to prevent persisting display values.
	 */
	private async computeTaxIdFields(rawValue: string, taxRecordId: string) {
		if (isMaskedPlaceholder(rawValue)) {
			throw new BadRequestException({
				message: 'Cannot accept a masked placeholder as a tax ID value',
				i18nType: 'agent.tax.masked_placeholder',
			});
		}

		const result = await this.encryption.encryptField(rawValue, {
			tableName: 'tax', recordId: taxRecordId, fieldName: 'type_value',
		});
		return {
			valueLast4: result.lastFour,
			valueToken: result.blindIndex,
			ciphertext: result.ciphertext,
			encryptionKeyId: result.keyId,
			encryptionVersion: result.encryptionVersion,
			encryptedAt: result.encryptedAt,
		};
	}

	/**
	 * Creates a new tax for an agent.
	 * Creates both Tax record and AgentTax association.
	 *
	 * @param agentId - Agent UUID
	 * @param dto - Tax data to create (validated by Zod)
	 * @returns The created AgentTax with nested Tax
	 * @throws ConflictException if agent already has this tax type
	 * @throws BadRequestException if value is a masked placeholder
	 */
	async create(agentId: string, dto: CreateAgentTaxInput): Promise<AgentTax> {
		const startTime = Date.now();

		try {
			// Check for existing tax of same type for this agent (targeted query, no fan-out)
			const existingOfType = await this.repository.findByAgentIdAndType(agentId, dto.taxIdType);

			if (existingOfType) {
				throw new ConflictException({
					message: `Agent '${agentId}' already has a tax of type '${dto.taxIdType}'`,
					i18nType: 'agent.tax.duplicate_type',
				});
			}

			// Pre-generate UUID so encryption context is bound to this record
			const taxRecordId = randomUUID();
			const fields = await this.computeTaxIdFields(dto.value, taxRecordId);

			// Create tax via repository (handles transaction)
			const agentTax = await this.repository.createWithTax(
				agentId,
				{
					taxIdType: dto.taxIdType,
					valueLast4: fields.valueLast4,
					valueToken: fields.valueToken,
					id: taxRecordId,
					ciphertext: fields.ciphertext,
					encryptionKeyId: fields.encryptionKeyId,
					encryptionVersion: fields.encryptionVersion,
					encryptedAt: fields.encryptedAt,
				},
				dto.isPrimary ?? false,
			);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Agent tax created: ${agentTax.id} (agent: ${agentId}, type: ${dto.taxIdType}) in ${duration}ms`,
			);

			return agentTax;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof ConflictException || error instanceof BadRequestException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create agent tax: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves an AgentTax by its UUID, scoped to an agent.
	 * Verifies both existence and ownership in a single DB call.
	 *
	 * @param agentId - Agent UUID (for ownership check)
	 * @param taxId - AgentTax UUID
	 * @returns The AgentTax with nested Tax
	 * @throws NotFoundException if not found or doesn't belong to agent
	 */
	async findById(agentId: string, taxId: string): Promise<AgentTax> {
		const startTime = Date.now();

		try {
			const agentTax = await this.repository.findById(taxId);

			if (!agentTax) {
				throw new NotFoundException({
					message: `Agent tax with id '${taxId}' not found`,
					i18nType: 'agent.tax.not_found',
				});
			}

			if (agentTax.agentId !== agentId) {
				throw new NotFoundException({
					message: `Tax with id '${taxId}' not found for agent '${agentId}'`,
					i18nType: 'agent.tax.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(`AgentTax retrieved: ${agentTax.id} in ${duration}ms`);

			return agentTax;
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to retrieve agent tax: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Lists taxes for an agent with pagination.
	 *
	 * @param agentId - Agent UUID
	 * @param query - Optional pagination/filter params
	 * @returns Paginated AgentTax records with nested Tax for the agent
	 */
	async findByAgentId(agentId: string, query?: Partial<QueryParams>): Promise<PageResult<AgentTax>> {
		const startTime = Date.now();

		try {
			const result = await this.repository.findByAgentId(agentId, query);

			const duration = Date.now() - startTime;
			this.logger.debug(`Found ${result.items.length} taxes for agent ${agentId} in ${duration}ms`);

			return result;
		} catch (error) {
			this.logger.error(
				`Failed to list agent taxes: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Updates an agent tax (value or isPrimary).
	 *
	 * @param agentId - Agent UUID (for ownership check)
	 * @param taxId - AgentTax UUID
	 * @param dto - Update data
	 * @returns The updated AgentTax with nested Tax
	 * @throws NotFoundException if not found or doesn't belong to agent
	 * @throws BadRequestException if value is a masked placeholder
	 */
	async update(agentId: string, taxId: string, dto: UpdateAgentTaxInput): Promise<AgentTax> {
		const startTime = Date.now();

		try {
			// Verify exists + ownership (single DB call)
			const existing = await this.findById(agentId, taxId);

			// Update tax value if provided (AgentTax always has a nested Tax — findById joins it)
			if (dto.value !== undefined) {
				const fields = await this.computeTaxIdFields(dto.value, existing.taxId);
				await this.repository.updateTaxValue(
					existing.taxId,
					fields.valueLast4,
					fields.valueToken,
					fields.ciphertext,
					fields.encryptionKeyId,
					fields.encryptionVersion,
					fields.encryptedAt,
				);
			}

			// Update isPrimary if provided
			// The partial unique index idx_agent_tax_agent_primary enforces
			// at most one primary per agent — ProblemDetailsFilter maps the
			// resulting 23505 violation to a 409 Conflict automatically.
			if (dto.isPrimary !== undefined) {
				await this.repository.update(taxId, { isPrimary: dto.isPrimary });
			}

			// Re-fetch to get updated data
			const updated = await this.repository.findById(taxId);
			if (!updated) {
				throw new Error(`Agent tax with id ${taxId} not found after update`);
			}

			const duration = Date.now() - startTime;
			this.logger.info(`Agent tax updated: ${taxId} in ${duration}ms`);

			return updated;
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}

			this.logger.error(
				`Failed to update agent tax: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}
}
