import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isMaskedPlaceholder } from '@exprealty/shared-domain';
import type { FieldEncryptionService } from '@exprealty/encryption';
import type { IAgentCompanyRepository } from './ports/agent-company.repository.port.js';
import type {
	CreateAgentCompanyInput,
	UpdateAgentCompanyInput,
	AgentCompany,
	QueryParams,
	FieldSelection
} from '@exprealty/shared-domain';

// Internal write payload: strips the raw taxId from the DTO and substitutes
// pre-computed derived fields for persistence.
type AgentCompanyWritePayload = Omit<CreateAgentCompanyInput, 'taxId'> & {
	id?: string;
	taxId?: Buffer | null;
	taxIdLast4?: string | null;
	taxIdToken?: string | null;
	encryptionKeyId?: string | null;
	encryptionVersion?: number | null;
	encryptedAt?: Date | null;
};
import { LoggerService } from '../../core/logger.service.js';
import type { PageResult } from '../../common/ports/pagination.types.js';

/**
 * Application service for managing AgentCompany aggregate.
 * Handles business logic and orchestrates domain operations.
 */
@Injectable()
export class AgentCompanyService {
	constructor(
		@Inject('IAgentCompanyRepository')
		private readonly repository: IAgentCompanyRepository,
		@Inject('FIELD_ENCRYPTION')
		private readonly encryption: FieldEncryptionService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(AgentCompanyService.name);
	}

	/**
	 * Prepare tax ID fields for persistence from a DTO.
	 * Encrypts the value and returns all derived columns.
	 */
	private async prepareTaxFields(
		taxId: string | null | undefined,
		recordId: string,
	): Promise<Partial<AgentCompanyWritePayload>> {
		if (taxId === null) {
			return {
				taxIdLast4: null, taxIdToken: null, taxId: null,
				encryptionKeyId: null, encryptionVersion: null, encryptedAt: null,
			};
		}
		if (taxId === undefined) {
			return {};
		}
		if (isMaskedPlaceholder(taxId)) {
			throw new BadRequestException({
				message: 'Cannot accept a masked placeholder as a tax ID value',
				i18nType: 'agent.company.masked_placeholder',
			});
		}

		const result = await this.encryption.encryptField(taxId, {
			tableName: 'agent_company', recordId, fieldName: 'tax_id',
		});
		return {
			taxId: result.ciphertext,
			taxIdLast4: result.lastFour,
			taxIdToken: result.blindIndex,
			encryptionKeyId: result.keyId,
			encryptionVersion: result.encryptionVersion,
			encryptedAt: result.encryptedAt,
		};
	}

	/**
	 * Creates a new agent company.
	 *
	 * @param dto - Company data to create (validated by Zod)
	 * @returns The created company
	 * @throws ConflictException if company with same name exists
	 * @throws BadRequestException if taxId is a masked placeholder
	 */
	async create(dto: CreateAgentCompanyInput): Promise<AgentCompany> {
		const startTime = Date.now();

		try {
			// Check for existing company with same name
			const existing = await this.repository.findByName(dto.name);

			if (existing) {
				throw new ConflictException({
					message: `An agent company with name '${dto.name}' already exists`,
					i18nType: 'agent.company.duplicate_name',
				});
			}

			// Pre-generate UUID so encryption context is bound to this record
			const companyId = randomUUID();
			const taxFields = await this.prepareTaxFields(dto.taxId, companyId);
			const { taxId: _rawTaxId, ...restDto } = dto;
			const payload: AgentCompanyWritePayload = { id: companyId, ...restDto, ...taxFields };
			const company = await this.repository.create(payload as unknown as Omit<AgentCompany, 'id'>);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Agent company created: ${company.id} (${company.name}) in ${duration}ms`,
			);

			return company;
		} catch (error) {
			if (error instanceof ConflictException || error instanceof BadRequestException) {
				throw error;
			}

			this.logger.error(
				`Failed to create agent company: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves a company by its UUID.
	 *
	 * @param id - Company UUID
	 * @returns The company
	 * @throws NotFoundException if not found
	 */
	async findById(id: string): Promise<AgentCompany> {
		const startTime = Date.now();

		try {
			const company = await this.repository.findById(id);

			if (!company) {
				throw new NotFoundException({
					message: `Agent company with id '${id}' not found`,
					i18nType: 'agent.company.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(`Company retrieved: ${company.id} in ${duration}ms`);

			return company;
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to find company ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);

			throw error;
		}
	}

	/**
	 * Retrieves paginated companies.
	 *
	 * @param query - Query parameters
	 * @param selection - Field selection
	 * @returns Paginated companies
	 */
	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<AgentCompany>> {
		return this.repository.findPage(query, selection);
	}

	/**
	 * Updates a company.
	 *
	 * @param id - Company UUID
	 * @param dto - Update data (validated by Zod)
	 * @returns The updated company
	 * @throws NotFoundException if not found
	 * @throws BadRequestException if taxId is a masked placeholder
	 */
	async update(id: string, dto: UpdateAgentCompanyInput): Promise<AgentCompany> {
		const startTime = Date.now();

		try {
			// Verify company exists
			const existing = await this.repository.findById(id);

			if (!existing) {
				throw new NotFoundException({
					message: `Agent company with id '${id}' not found`,
					i18nType: 'agent.company.not_found',
				});
			}

			// If changing name, check for duplicates
			if (dto.name && dto.name !== existing.name) {
				const duplicate = await this.repository.findByName(dto.name);
				if (duplicate) {
					throw new ConflictException({
						message: `An agent company with name '${dto.name}' already exists`,
						i18nType: 'agent.company.duplicate_name',
					});
				}
			}

			// Encrypt taxId using the existing company's id as context
			const taxFields = await this.prepareTaxFields(dto.taxId, id);
			const { taxId: _rawTaxId, ...restDto } = dto;
			const patch: Partial<AgentCompanyWritePayload> = { ...restDto, ...taxFields };
			const updated = await this.repository.update(id, patch as unknown as Partial<AgentCompany>);

			const duration = Date.now() - startTime;
			this.logger.info(`Company updated: ${id} in ${duration}ms`);

			return updated;
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
				throw error;
			}

			this.logger.error(
				`Failed to update company ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);

			throw error;
		}
	}

	/**
	 * Deletes a company.
	 *
	 * @param id - Company UUID
	 * @throws NotFoundException if not found
	 */
	async delete(id: string): Promise<void> {
		const startTime = Date.now();

		try {
			// Verify company exists
			const existing = await this.repository.findById(id);

			if (!existing) {
				throw new NotFoundException({
					message: `Agent company with id '${id}' not found`,
					i18nType: 'agent.company.not_found',
				});
			}

			await this.repository.delete(id);

			const duration = Date.now() - startTime;
			this.logger.info(`Company deleted: ${id} in ${duration}ms`);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to delete company ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);

			throw error;
		}
	}
}
