import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import type { IMLSRepository } from './ports/mls.repository.port.js';
import type { CreateMLSInput, UpdateMLSInput, MLSType, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Application service for managing MLS aggregate.
 * Handles business logic and orchestrates domain operations.
 * 
 * Depends on IMLSRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class MLSService {

	constructor(
		@Inject('IMLSRepository')
		private readonly repository: IMLSRepository,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(MLSService.name);
	}

	/**
	 * Creates a new MLS record.
	 *
	 * @param dto - MLS data to create (validated by Zod)
	 * @returns The created MLS entity
	 * @throws ConflictException if an MLS with the same name already exists
	 */
	async create(dto: CreateMLSInput): Promise<MLSType> {
		const startTime = Date.now();

		try {
			// Check for existing MLS with same name
			const existing = await this.repository.findByName(dto.name);

			if (existing) {
				throw new ConflictException({
					message: `An MLS with name '${dto.name}' already exists`,
					i18nType: 'agent.mls.duplicate_name',
				});
			}

			// Check for existing MLS with same global ID (if provided)
			if (dto.globalId !== undefined) {
				const existingByGlobalId = await this.repository.findByGlobalId(dto.globalId);
				if (existingByGlobalId) {
					throw new ConflictException({
						message: `An MLS with global_id '${dto.globalId}' already exists`,
						i18nType: 'agent.mls.duplicate_global_id',
					});
				}
			}

			// Create MLS via repository
			const savedMLS = await this.repository.create(dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`MLS created successfully: ${savedMLS.id} (${savedMLS.name}) in ${duration}ms`,
			);

			return savedMLS;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create MLS ${dto.name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Retrieves an MLS by its ID (bigint as string).
	 *
	 * @param id - MLS ID
	 * @returns The MLS entity
	 * @throws NotFoundException if MLS with the given id does not exist
	 */
	async findById(id: string): Promise<MLSType> {
		const startTime = Date.now();

		try {
			const mls = await this.repository.findById(id);

			if (!mls) {
				throw new NotFoundException({
					message: `MLS with id '${id}' not found`,
					i18nType: 'agent.mls.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`MLS retrieved: ${mls.id} (${mls.name}) in ${duration}ms`,
			);

			return mls;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to find MLS ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Finds an MLS by name.
	 *
	 * @param name - MLS name
	 * @returns The MLS entity or null if not found
	 */
	async findByName(name: string): Promise<MLSType | null> {
		return this.repository.findByName(name);
	}

	/**
	 * Retrieves all MLS records with pagination, filtering, sorting, and search.
	 *
	 * @param params - Query parameters
	 * @param fieldSelection - Field selection for projection
	 * @returns Paginated list of MLS records
	 */
	async findAll(
		params?: QueryParams,
		fieldSelection?: FieldSelection,
	): Promise<{ data: MLSType[]; total: number }> {
		const startTime = Date.now();

		try {
			const result = await this.repository.findPage(params, fieldSelection);

			const duration = Date.now() - startTime;
			this.logger.debug(
				`MLS list retrieved: ${result.items.length} of ${result.total} in ${duration}ms`,
			);

			return { data: result.items, total: result.total };
		} catch (error) {
			const duration = Date.now() - startTime;

			this.logger.error(
				`Failed to list MLS: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Updates an existing MLS record.
	 *
	 * @param id - MLS ID
	 * @param dto - Updated MLS data (partial)
	 * @returns The updated MLS entity
	 * @throws NotFoundException if MLS with the given id does not exist
	 * @throws ConflictException if the new name already exists
	 */
	async update(id: string, dto: UpdateMLSInput): Promise<MLSType> {
		const startTime = Date.now();

		try {
			// Check if MLS exists
			const existing = await this.repository.findById(id);

			if (!existing) {
				throw new NotFoundException({
					message: `MLS with id '${id}' not found`,
					i18nType: 'agent.mls.not_found',
				});
			}

			// Check for duplicate name if name is being updated
			if (dto.name && dto.name !== existing.name) {
				const duplicateName = await this.repository.findByName(dto.name);
				if (duplicateName) {
					throw new ConflictException({
						message: `An MLS with name '${dto.name}' already exists`,
						i18nType: 'agent.mls.duplicate_name',
					});
				}
			}

			// Check for duplicate global ID if being updated
			if (dto.globalId !== undefined && dto.globalId !== existing.globalId) {
				const duplicateGlobalId = await this.repository.findByGlobalId(dto.globalId);
				if (duplicateGlobalId) {
					throw new ConflictException({
						message: `An MLS with global_id '${dto.globalId}' already exists`,
						i18nType: 'agent.mls.duplicate_global_id',
					});
				}
			}

			// Update MLS via repository
			const updatedMLS = await this.repository.update(id, dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`MLS updated successfully: ${updatedMLS.id} (${updatedMLS.name}) in ${duration}ms`,
			);

			return updatedMLS;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof NotFoundException || error instanceof ConflictException) {
				throw error;
			}

			this.logger.error(
				`Failed to update MLS ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}
}
