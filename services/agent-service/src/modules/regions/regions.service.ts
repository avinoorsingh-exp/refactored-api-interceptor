import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { RegionEntity } from '@exprealty/database'
import type { CreateRegionInput, UpdateRegionInput, Region } from '@exprealty/shared-domain'

/**
 * Service for managing Region entities.
 * Handles business logic for region operations.
 */
@Injectable()
export class RegionsService {
	private readonly logger = new Logger(RegionsService.name)

	constructor(
		@InjectRepository(RegionEntity)
		private readonly regionRepository: Repository<RegionEntity>,
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
			const existing = await this.regionRepository.findOne({
				where: { name: normalizedName },
			})

			if (existing) {
				throw new ConflictException({
					message: `A region with name '${dto.name}' already exists`,
					i18nType: 'agent.region.duplicate_name',
				})
			}

			// Create entity instance with normalized name
			const region = this.regionRepository.create({
				name: normalizedName,
			})

			// Persist to database
			const savedRegion = await this.regionRepository.save(region)

			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.log(
				`Region created successfully: ${savedRegion.id} (${savedRegion.name}) in ${duration}ms`,
			)

			return this.mapToResponse(savedRegion)
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error
			}

			// Handle unique constraint violation (if exists at DB level)
			if (error instanceof QueryFailedError) {
				const pgError = error as QueryFailedError & {
					code?: string
					detail?: string
				}

				if (pgError.code === '23505') {
					// TODO: Remove debug logging before PR
					this.logger.warn(
						`Duplicate region name attempted: ${dto.name} (${duration}ms)`,
					)
					throw new ConflictException({
						message: `A region with name '${dto.name}' already exists`,
						i18nType: 'agent.region.duplicate_name',
					})
				}
			}

			// TODO: Remove debug logging before PR
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
			const region = await this.regionRepository.findOne({
				where: { id },
			})

			if (!region) {
				throw new NotFoundException({
					message: `Region with id '${id}' not found`,
					i18nType: 'agent.region.not_found',
				})
			}

			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.debug(
				`Region retrieved: ${region.id} (${region.name}) in ${duration}ms`,
			)

			return this.mapToResponse(region)
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error
			}

			// TODO: Remove debug logging before PR
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
			const existingRegion = await this.regionRepository.findOne({
				where: { id },
			})

			if (!existingRegion) {
				throw new NotFoundException({
					message: `Region with id '${id}' not found`,
					i18nType: 'agent.region.not_found',
				})
			}

			// Normalize name for duplicate check and storage
			const normalizedName = dto.name.toLowerCase().trim()

			// Check if another region already has this name (excluding current region)
			const duplicateRegion = await this.regionRepository.findOne({
				where: { name: normalizedName },
			})

			if (duplicateRegion && duplicateRegion.id !== id) {
				throw new ConflictException({
					message: `A region with name '${dto.name}' already exists`,
					i18nType: 'agent.region.duplicate_name',
				})
			}

			// TODO: Remove debug logging before PR
			this.logger.debug(
				`Updating region: ${id} (${existingRegion.name})`,
			)

			// Update entity
			existingRegion.name = normalizedName

			// Save changes
			const updatedRegion = await this.regionRepository.save(
				existingRegion,
			)

			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.log(
				`Region updated successfully: ${updatedRegion.id} in ${duration}ms`,
			)

			return this.mapToResponse(updatedRegion)
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (
				error instanceof NotFoundException ||
				error instanceof ConflictException
			) {
				throw error
			}

			// Handle unique constraint violation (if exists at DB level)
			if (error instanceof QueryFailedError) {
				const pgError = error as QueryFailedError & {
					code?: string
					detail?: string
				}

				if (pgError.code === '23505') {
					// TODO: Remove debug logging before PR
					this.logger.warn(
						`Duplicate region name attempted during update: ${dto.name} (${duration}ms)`,
					)
					throw new ConflictException({
						message: `A region with name '${dto.name}' already exists`,
						i18nType: 'agent.region.duplicate_name',
					})
				}
			}

			// TODO: Remove debug logging before PR
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
	 * Maps a RegionEntity to a Region domain type.
	 *
	 * @param entity - The region entity from the database
	 * @returns The region domain object
	 */
	private mapToResponse(entity: RegionEntity): Region {
		return {
			id: entity.id,
			name: entity.name,
		}
	}
}
