import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { ISystemsRepository } from './ports/systems.repository.port.js'
import type { PageResult } from '../../../common/ports/pagination.types.js'
import { SystemEntity } from '@exprealty/database'
import type { System, CreateSystemInput, UpdateSystemInput, QueryParams } from '@exprealty/shared-domain'
import { QueryService } from '../../../common/query/query.service.js'

/**
 * Maps a SystemEntity (infrastructure) to System domain type.
 */
const mapEntity = (e: SystemEntity): System => ({
	id: e.id,
	countryId: e.countryId,
	currencyId: e.currencyId,
	description: e.description,
	created: e.created,
	lastModified: e.lastModified,
	modifiedBy: e.modifiedBy,
})

/**
 * TypeORM adapter implementation of ISystemsRepository.
 */
@Injectable()
export class SystemsRepository implements ISystemsRepository {
	constructor(
		@InjectRepository(SystemEntity)
		private readonly repo: Repository<SystemEntity>,
		private readonly queryService: QueryService,
	) {}

	/**
	 * Find a system by its ID.
	 */
	async findById(id: string): Promise<System | null> {
		const entity = await this.repo.findOne({ where: { id } })
		return entity ? mapEntity(entity) : null
	}

	/**
	 * Find a system by ID within a specific country.
	 */
	async findByIdInCountry(countryId: number, systemId: string): Promise<System | null> {
		const entity = await this.repo.findOne({
			where: { id: systemId, countryId },
		})
		return entity ? mapEntity(entity) : null
	}

	/**
	 * Retrieve a paginated list of systems for a country.
	 * Default sort: description ASC.
	 */
	async findPageByCountry(
		countryId: number,
		query: Partial<QueryParams>,
	): Promise<PageResult<System>> {
		// Validate and normalize query params using entity decorators
		const normalized = this.queryService.normalizeWithValidation(query, SystemEntity)

		// Build query with TypeORM query builder
		const qb = this.repo.createQueryBuilder('system')

		// Filter by country ID
		qb.where('system.country_id = :countryId', { countryId })

		// Apply filters, search, and sorting with strategy-based search
		this.queryService.applyAllWithStrategies(qb, normalized, SystemEntity, 'system')

		// Default sort by description ASC if no sort specified
		if (!normalized.sort || normalized.sort.conditions.length === 0) {
			qb.orderBy('system.description', 'ASC')
		}

		// Apply pagination
		qb.skip(normalized.offset).take(normalized.limit)

		// Execute query
		const [entities, total] = await qb.getManyAndCount()

		return {
			items: entities.map(mapEntity),
			total,
		}
	}

	/**
	 * Create a new system for a country.
	 */
	async create(countryId: number, data: CreateSystemInput): Promise<System> {
		const entity = this.repo.create({
			countryId,
			currencyId: data.currencyId,
			description: data.description,
		})
		const saved = await this.repo.save(entity)
		return mapEntity(saved)
	}

	/**
	 * Update an existing system.
	 */
	async update(id: string, patch: UpdateSystemInput): Promise<System> {
		await this.repo.update({ id }, patch)
		const updated = await this.repo.findOne({ where: { id } })
		if (!updated) {
			throw new NotFoundException({
				message: `System with ID '${id}' not found`,
				i18nType: 'system.not_found',
			})
		}
		return mapEntity(updated)
	}
}
