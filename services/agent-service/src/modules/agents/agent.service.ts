import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import type { IAgentRepository } from './ports/agent.repository.port.js';
import type { CreateAgentInput, UpdateAgentInput, Agent, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Application service for managing Agent aggregate.
 * Handles business logic and orchestrates domain operations.
 * 
 * Depends on IAgentRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class AgentService {

	constructor(
		@Inject('IAgentRepository')
		private readonly repository: IAgentRepository,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(AgentService.name);
	}

	/**
	 * Creates a new Agent record.
	 *
	 * @param dto - Agent data to create (validated by Zod)
	 * @returns The created Agent entity
	 * @throws ConflictException if an Agent with the same email already exists
	 */
	async create(dto: CreateAgentInput): Promise<Agent> {
		const startTime = Date.now();

		try {
			// Check for existing agent with same email
			const existing = await this.repository.findByEmail(dto.email);

			if (existing) {
				throw new ConflictException({
					message: `An agent with email '${dto.email}' already exists`,
					i18nType: 'agent.duplicate_email',
				});
			}

			// Create Agent via repository
			const savedAgent = await this.repository.create(dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Agent created successfully: ${savedAgent.id} (${savedAgent.firstName} ${savedAgent.lastName}) in ${duration}ms`,
			);

			return savedAgent;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create agent ${dto.firstName} ${dto.lastName}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Retrieves an Agent by its ID (UUID).
	 *
	 * @param id - Agent ID (UUID)
	 * @param selection - Optional field selection for projection and includes
	 * @returns The Agent entity
	 * @throws NotFoundException if Agent with the given id does not exist
	 */
	async findById(id: string, selection?: FieldSelection): Promise<Agent> {
		const startTime = Date.now();

		try {
			let agent: Agent | null;

			// If selection is provided with includes, use findPage with id filter
			// This allows eager loading of relations via projection
			if (selection?.include && selection.include.length > 0) {
				const params: QueryParams = {
					filter: {
						conditions: [{ field: 'id', operator: 'eq', value: id }],
						logicalOperator: 'AND',
					},
					limit: 1,
					offset: 0,
				};
				const result = await this.repository.findPage(params, selection);
				agent = result.items[0] || null;
			} else {
				agent = await this.repository.findById(id);
			}

			if (!agent) {
				throw new NotFoundException({
					message: `Agent with id '${id}' not found`,
					i18nType: 'agent.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Agent retrieved: ${agent.id} (${agent.firstName} ${agent.lastName}) in ${duration}ms`,
			);

			return agent;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to find agent ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Finds an agent by email.
	 *
	 * @param email - Agent email
	 * @returns The Agent entity or null if not found
	 */
	async findByEmail(email: string): Promise<Agent | null> {
		return this.repository.findByEmail(email);
	}

	/**
	 * Finds an agent by legacy agent ID.
	 *
	 * @param agentId - Legacy agent ID (bigint as string)
	 * @returns The Agent entity or null if not found
	 */
	async findByAgentId(agentId: string): Promise<Agent | null> {
		return this.repository.findByAgentId(agentId);
	}

	/**
	 * Retrieves all Agent records with pagination, filtering, sorting, and search.
	 *
	 * @param params - Query parameters
	 * @param fieldSelection - Field selection for projection
	 * @returns Paginated list of Agent records
	 */
	async findAll(
		params?: QueryParams,
		fieldSelection?: FieldSelection,
	): Promise<{ data: Agent[]; total: number }> {
		const startTime = Date.now();

		try {
			const result = await this.repository.findPage(params, fieldSelection);

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Agent list retrieved: ${result.items.length} of ${result.total} in ${duration}ms`,
			);

			return { data: result.items, total: result.total };
		} catch (error) {
			const duration = Date.now() - startTime;

			this.logger.error(
				`Failed to list agents: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Updates an existing Agent record.
	 *
	 * @param id - Agent ID
	 * @param dto - Updated Agent data (partial)
	 * @returns The updated Agent entity
	 * @throws NotFoundException if Agent with the given id does not exist
	 * @throws ConflictException if the new email already exists
	 */
	async update(id: string, dto: UpdateAgentInput): Promise<Agent> {
		const startTime = Date.now();

		try {
			// Check if agent exists
			const existing = await this.repository.findById(id);

			if (!existing) {
				throw new NotFoundException({
					message: `Agent with id '${id}' not found`,
					i18nType: 'agent.not_found',
				});
			}

			// Check for duplicate email if email is being updated
			if (dto.email && dto.email !== existing.email) {
				const duplicateEmail = await this.repository.findByEmail(dto.email);
				if (duplicateEmail) {
					throw new ConflictException({
						message: `An agent with email '${dto.email}' already exists`,
						i18nType: 'agent.duplicate_email',
					});
				}
			}

			// Update Agent via repository
			const updatedAgent = await this.repository.update(id, dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Agent updated successfully: ${updatedAgent.id} (${updatedAgent.firstName} ${updatedAgent.lastName}) in ${duration}ms`,
			);

			return updatedAgent;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof NotFoundException || error instanceof ConflictException) {
				throw error;
			}

			this.logger.error(
				`Failed to update agent ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}
}
