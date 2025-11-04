import { Injectable, ConflictException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { RegionEntity } from '@exprealty/database'
import type { CreateRegionInput, Region } from '@exprealty/shared-domain'

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
