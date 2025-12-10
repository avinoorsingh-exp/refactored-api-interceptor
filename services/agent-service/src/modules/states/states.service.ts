import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import type { IStatesRepository } from './ports/states.repository.port.js';
import type { CreateStateInput, UpdateStateInput, State, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Application service for managing State aggregate.
 * Handles business logic and orchestrates domain operations.
 * 
 * Depends on IStatesRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class StatesService {
	constructor(
		@Inject('IStatesRepository')
		private readonly repository: IStatesRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(StatesService.name)
	}

	/**
	 * Creates a new state record.
	 *
	 * @param dto - State data to create (validated by Zod)
	 * @returns The created state entity
	 * @throws ConflictException if a state with the same code already exists
	 */
	async create(dto: CreateStateInput): Promise<State> {
		const startTime = Date.now();

		try {
			// Check for existing state with same code
			const existing = await this.repository.findByCode(dto.code);

			if (existing) {
				throw new ConflictException({
					message: `A state with code '${dto.code}' already exists`,
					i18nType: 'agent.state.duplicate_code',
				});
			}

			// Create state via repository
			const savedState = await this.repository.create(dto as any);

			const duration = Date.now() - startTime;
			this.logger.log(
				`State created successfully: ${savedState.id} (${savedState.code}) in ${duration}ms`,
			);

			return savedState;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create state ${dto.code}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Retrieves a state by its UUID.
	 *
	 * @param id - State UUID
	 * @returns The state entity
	 * @throws NotFoundException if state with the given id does not exist
	 */
	async findById(id: string): Promise<State> {
		const startTime = Date.now();

		try {
			const state = await this.repository.findById(id);

			if (!state) {
				throw new NotFoundException({
					message: `State with id '${id}' not found`,
					i18nType: 'agent.state.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`State retrieved: ${state.id} (${state.code}) in ${duration}ms`,
			);

			return state;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve state ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Retrieves a state by its code.
	 *
	 * @param code - State code (e.g., 'TX', 'CA')
	 * @returns The state entity
	 * @throws NotFoundException if state with the given code does not exist
	 */
	async findByCode(code: string): Promise<State> {
		const startTime = Date.now();

		try {
			const state = await this.repository.findByCode(code);

			if (!state) {
				throw new NotFoundException({
					message: `State with code '${code}' not found`,
					i18nType: 'agent.state.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`State retrieved by code: ${state.id} (${state.code}) in ${duration}ms`,
			);

			return state;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve state by code ${code}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Updates an existing state record by ID.
	 *
	 * @param id - The state ID to update
	 * @param dto - State data to update (validated by Zod)
	 * @returns The updated state entity
	 * @throws NotFoundException if the state with the given ID does not exist
	 * @throws ConflictException if the update would violate unique code constraint
	 */
	async update(id: string, dto: UpdateStateInput): Promise<State> {
		const startTime = Date.now();

		try {
			// Check if state exists
			const existingState = await this.repository.findById(id);

			if (!existingState) {
				throw new NotFoundException({
					message: `State with id '${id}' not found`,
					i18nType: 'agent.state.not_found',
				});
			}

			// If code is being updated, check for duplicates
			if (dto.code && dto.code !== existingState.code) {
				const duplicateState = await this.repository.findByCode(dto.code);

				if (duplicateState && duplicateState.id !== id) {
					throw new ConflictException({
						message: `A state with code '${dto.code}' already exists`,
						i18nType: 'agent.state.duplicate_code',
					});
				}
			}

			this.logger.debug(
				`Updating state: ${id} (${existingState.code})`,
			);

			// Update via repository
			const updatedState = await this.repository.update(id, dto as any);

			const duration = Date.now() - startTime;
			this.logger.log(
				`State updated successfully: ${updatedState.id} in ${duration}ms`,
			);

			return updatedState;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (
				error instanceof NotFoundException ||
				error instanceof ConflictException
			) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to update state ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of states with optional filtering, sorting, and search.
	 * Default sort: name ASC
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param selection - Optional field selection for projection
	 * @returns Object containing states array and total count
	 */
	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<{ states: State[]; total: number }> {
		const startTime = Date.now();

		try {
			// Repository validates and applies filters, sort, search, and projection
			const result = await this.repository.findPage(query, selection);

			const duration = Date.now() - startTime;
			this.logger.log(
				`Retrieved ${result.items.length} states (offset: ${query.offset ?? 0}, limit: ${query.limit ?? 25}, ` +
				`filter: ${query.filter ? 'yes' : 'no'}, sort: ${query.sort ? 'yes' : 'no'}, search: ${query.search ? 'yes' : 'no'}, total: ${result.total}) in ${duration}ms`,
			);

			return {
				states: result.items,
				total: result.total,
			};
		} catch (error) {
			const duration = Date.now() - startTime;
			this.logger.error(
				`Failed to retrieve states page: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			);
			throw error;
		}
	}
}
