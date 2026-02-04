import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import type { IAgentCompanyAssociationRepository } from './ports/agent-company-association.repository.port.js';
import type { 
	CreateAgentCompanyAssociationInput, 
	UpdateAgentCompanyAssociationInput, 
	AgentCompanyAssociation, 
	QueryParams, 
	FieldSelection 
} from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';
import type { PageResult } from '../../common/ports/pagination.types.js';

/**
 * Application service for managing AgentCompanyAssociation aggregate.
 * Handles business logic and orchestrates domain operations.
 * 
 * Depends on IAgentCompanyAssociationRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class AgentCompanyAssociationService {
	constructor(
		@Inject('IAgentCompanyAssociationRepository')
		private readonly repository: IAgentCompanyAssociationRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(AgentCompanyAssociationService.name);
	}

	/**
	 * Creates a new agent company association.
	 *
	 * @param agentId - Agent UUID
	 * @param dto - Association data to create (validated by Zod)
	 * @returns The created association
	 * @throws ConflictException if association already exists
	 */
	async create(agentId: string, dto: CreateAgentCompanyAssociationInput): Promise<AgentCompanyAssociation> {
		const startTime = Date.now();

		try {
			// Check for existing association
			const existing = await this.repository.findByAgentAndCompany(agentId, dto.agentCompanyId);

			if (existing) {
				throw new ConflictException({
					message: `Agent '${agentId}' is already associated with company '${dto.agentCompanyId}'`,
					i18nType: 'agent.company_association.duplicate',
				});
			}

			// If setting as primary, clear existing primary
			if (dto.isPrimary) {
				await this.repository.clearPrimaryForAgent(agentId);
			}

			// Create association via repository
			const association = await this.repository.create({
				agentId,
				agentCompanyId: dto.agentCompanyId,
				isPrimary: dto.isPrimary ?? false,
			});

			const duration = Date.now() - startTime;
			this.logger.info(
				`Agent company association created: ${association.id} (agent: ${agentId}, company: ${dto.agentCompanyId}) in ${duration}ms`,
			);

			return association;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create agent company association: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves an association by its UUID.
	 *
	 * @param id - Association UUID
	 * @returns The association
	 * @throws NotFoundException if not found
	 */
	async findById(id: string): Promise<AgentCompanyAssociation> {
		const startTime = Date.now();

		try {
			const association = await this.repository.findById(id);

			if (!association) {
				throw new NotFoundException({
					message: `Agent company association with id '${id}' not found`,
					i18nType: 'agent.company_association.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(`Association retrieved: ${association.id} in ${duration}ms`);

			return association;
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to find association ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);

			throw error;
		}
	}

	/**
	 * Retrieves all associations for an agent.
	 *
	 * @param agentId - Agent UUID
	 * @returns List of associations
	 */
	async findByAgentId(agentId: string): Promise<AgentCompanyAssociation[]> {
		return this.repository.findByAgentId(agentId);
	}

	/**
	 * Retrieves paginated associations.
	 *
	 * @param query - Query parameters
	 * @param selection - Field selection
	 * @returns Paginated associations
	 */
	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<AgentCompanyAssociation>> {
		return this.repository.findPage(query, selection);
	}

	/**
	 * Updates an association.
	 *
	 * @param id - Association UUID
	 * @param dto - Update data (validated by Zod)
	 * @returns The updated association
	 * @throws NotFoundException if not found
	 */
	async update(id: string, dto: UpdateAgentCompanyAssociationInput): Promise<AgentCompanyAssociation> {
		const startTime = Date.now();

		try {
			// Verify association exists
			const existing = await this.repository.findById(id);

			if (!existing) {
				throw new NotFoundException({
					message: `Agent company association with id '${id}' not found`,
					i18nType: 'agent.company_association.not_found',
				});
			}

			// If setting as primary, clear existing primary for this agent
			if (dto.isPrimary && !existing.isPrimary) {
				await this.repository.clearPrimaryForAgent(existing.agentId);
			}

			// Update association
			const updated = await this.repository.update(id, dto);

			const duration = Date.now() - startTime;
			this.logger.info(`Association updated: ${id} in ${duration}ms`);

			return updated;
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to update association ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);

			throw error;
		}
	}

	/**
	 * Deletes an association.
	 *
	 * @param id - Association UUID
	 * @throws NotFoundException if not found
	 */
	async delete(id: string): Promise<void> {
		const startTime = Date.now();

		try {
			// Verify association exists
			const existing = await this.repository.findById(id);

			if (!existing) {
				throw new NotFoundException({
					message: `Agent company association with id '${id}' not found`,
					i18nType: 'agent.company_association.not_found',
				});
			}

			await this.repository.delete(id);

			const duration = Date.now() - startTime;
			this.logger.info(`Association deleted: ${id} in ${duration}ms`);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to delete association ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);

			throw error;
		}
	}
}
