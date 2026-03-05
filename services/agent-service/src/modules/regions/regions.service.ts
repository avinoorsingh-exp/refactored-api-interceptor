import { Injectable, ConflictException, Logger, NotFoundException, Inject } from '@nestjs/common'
import type { IRegionsRepository } from './ports/regions.repository.port.js'
import type { CreateRegionInput, UpdateRegionInput, Region, QueryParams } from '@exprealty/shared-domain'

/**
 * Application service for managing Region aggregate.
 * Handles business logic and orchestrates domain operations.
 * 
 * Depends on IRegionsRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class RegionsService {
	private readonly logger = new Logger(RegionsService.name)

	constructor(
		@Inject('IRegionsRepository')
		private readonly repository: IRegionsRepository,
	) {}

	/**
	 * Creates a new region record.
	 *
	 * @param dto - Region data to create (validated by Zod)
	 * @returns The created region entity
	 * @throws ConflictException if a region with the same normalized name already exists
	 */
	async create(dto: CreateRegionInput): Promise<Region> {
		const startTime = Date.now()

		try {
			// Normalize name for duplicate check (lowercase, trim)
			const normalizedName = dto.name.toLowerCase().trim()

			// Check for existing region with same normalized name
			const existing = await this.repository.findByNormalizedName(normalizedName)

			if (existing) {
				throw new ConflictException({
					message: `A region with name '${dto.name}' already exists`,
					i18nType: 'agent.region.duplicate_name',
				})
			}

			// Create region via repository
			const savedRegion = await this.repository.create({
				name: normalizedName,
			})

			const duration = Date.now() - startTime
			this.logger.log(
				`Region created successfully: ${savedRegion.id} (${savedRegion.name}) in ${duration}ms`,
			)

			return savedRegion
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create region ${dto.name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)

			// Re-throw for controller to handle
			throw error
		}
	}

	/**
	 * Retrieves a region by its UUID.
	 *
	 * @param id - Region UUID
	 * @returns The region entity
	 * @throws NotFoundException if region with the given id does not exist
	 */
	async findById(id: string): Promise<Region> {
		const startTime = Date.now()

		try {
			const region = await this.repository.findById(id)

			if (!region) {
				throw new NotFoundException({
					message: `Region with id '${id}' not found`,
					i18nType: 'agent.region.not_found',
				})
			}

			const duration = Date.now() - startTime
			this.logger.debug(
				`Region retrieved: ${region.id} (${region.name}) in ${duration}ms`,
			)

			return region
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve region ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)

			// Re-throw for controller to handle
			throw error
		}
	}

	/**
	 * Updates an existing region record by ID.
	 *
	 * @param id - The region ID to update
	 * @param dto - Region data to update (validated by Zod)
	 * @returns The updated region entity
	 * @throws NotFoundException if the region with the given ID does not exist
	 * @throws ConflictException if the update would violate unique name constraint
	 */
	async update(id: string, dto: UpdateRegionInput): Promise<Region> {
		const startTime = Date.now()

		try {
			// Check if region exists
			const existingRegion = await this.repository.findById(id)

			if (!existingRegion) {
				throw new NotFoundException({
					message: `Region with id '${id}' not found`,
					i18nType: 'agent.region.not_found',
				})
			}

			// Normalize name for duplicate check and storage
			const normalizedName = dto.name.toLowerCase().trim()

			// Check if another region already has this name (excluding current region)
			const duplicateRegion = await this.repository.findByNormalizedName(normalizedName)

			if (duplicateRegion && duplicateRegion.id !== id) {
				throw new ConflictException({
					message: `A region with name '${dto.name}' already exists`,
					i18nType: 'agent.region.duplicate_name',
				})
			}

			this.logger.debug(
				`Updating region: ${id} (${existingRegion.name})`,
			)

			// Update via repository
			const updatedRegion = await this.repository.update(id, {
				name: normalizedName,
			})

			const duration = Date.now() - startTime
			this.logger.log(
				`Region updated successfully: ${updatedRegion.id} in ${duration}ms`,
			)

			return updatedRegion
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (
				error instanceof NotFoundException ||
				error instanceof ConflictException
			) {
				throw error
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to update region ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)

			// Re-throw for controller to handle
			throw error
		}
	}

	/**
	 * Retrieves a paginated list of regions with optional filtering, sorting, and search.
	 * Default sort: name ASC (AC-2)
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @returns Object containing regions array and total count
	 */
	async findPage(query: Partial<QueryParams>): Promise<{ regions: Region[]; total: number }> {
		const startTime = Date.now()

		try {
			// Repository validates and applies filters, sort, search
			const result = await this.repository.findPage(query)

			const duration = Date.now() - startTime
			this.logger.log(
				`Retrieved ${result.items.length} regions (offset: ${query.offset ?? 0}, limit: ${query.limit ?? 10}, ` +
				`filter: ${query.filter ? 'yes' : 'no'}, sort: ${query.sort ? 'yes' : 'no'}, search: ${query.search ? 'yes' : 'no'}, total: ${result.total}) in ${duration}ms`,
			)

			return {
				regions: result.items,
				total: result.total,
			}
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to retrieve regions page: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)
			throw error
		}
	}
}
