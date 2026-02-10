import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import type { IAgentCompanyRepository } from './ports/agent-company.repository.port.js';
import type { 
	CreateAgentCompanyInput, 
	UpdateAgentCompanyInput, 
	AgentCompany, 
	QueryParams, 
	FieldSelection 
} from '@exprealty/shared-domain';
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
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(AgentCompanyService.name);
	}

	/**
	 * Creates a new agent company.
	 *
	 * @param dto - Company data to create (validated by Zod)
	 * @returns The created company
	 * @throws ConflictException if company with same name exists
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

			// Create company via repository
			const company = await this.repository.create(dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Agent company created: ${company.id} (${company.name}) in ${duration}ms`,
			);

			return company;
		} catch (error) {
			if (error instanceof ConflictException) {
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

			// Update company
			const updated = await this.repository.update(id, dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(`Company updated: ${id} in ${duration}ms`);

			return updated;
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof ConflictException) {
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
