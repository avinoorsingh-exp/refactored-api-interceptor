import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { ICurrenciesRepository } from './ports/currencies.repository.port.js'
import type { PageResult } from '../../common/ports/pagination.types.js'
import { CurrencyEntity } from '@exprealty/database'
import type { Currency, QueryParams } from '@exprealty/shared-domain'
import { QueryService } from '../../common/query/query.service.js'

/**
 * Maps a CurrencyEntity (infrastructure) to Currency domain type.
 * This keeps the domain pure and independent of database implementation.
 */
const mapEntity = (e: CurrencyEntity): Currency => ({
	id: e.id,
	code: e.code,
	number: e.number,
	name: e.name,
	symbol: e.symbol,
	minorUnits: e.minorUnits,
	created: e.created,
	lastModified: e.lastModified,
	modifiedBy: e.modifiedBy,
})

/**
 * TypeORM adapter implementation of ICurrenciesRepository.
 *
 * This is the "adapter" in hexagonal architecture - it adapts TypeORM
 * to the port interface defined by the domain layer.
 */
@Injectable()
export class CurrenciesRepository implements ICurrenciesRepository {
	constructor(
		@InjectRepository(CurrencyEntity)
		private readonly repo: Repository<CurrencyEntity>,
		private readonly queryService: QueryService,
	) {}

	/**
	 * Find a currency by its numeric ID.
	 */
	async findById(id: number): Promise<Currency | null> {
		const entity = await this.repo.findOne({ where: { id } })
		return entity ? mapEntity(entity) : null
	}

	/**
	 * Find a currency by its ISO 4217 alpha-3 code (e.g., "USD").
	 */
	async findByCode(code: string): Promise<Currency | null> {
		const entity = await this.repo.findOne({ where: { code: code.toUpperCase() } })
		return entity ? mapEntity(entity) : null
	}

	/**
	 * Retrieve a paginated list of currencies with optional filtering, sorting, and search.
	 * Default sort: name ASC.
	 * Uses strategy-based search for type-aware searching on numeric fields.
	 */
	async findPage(query: Partial<QueryParams>): Promise<PageResult<Currency>> {
		// Validate and normalize query params using entity decorators
		const normalized = this.queryService.normalizeWithValidation(query, CurrencyEntity)

		// Build query with TypeORM query builder
		const qb = this.repo.createQueryBuilder('currency')

		// Apply filters, search, and sorting with strategy-based search
		this.queryService.applyAllWithStrategies(qb, normalized, CurrencyEntity, 'currency')

		// Default sort by name ASC if no sort specified
		if (!normalized.sort || normalized.sort.conditions.length === 0) {
			qb.orderBy('currency.name', 'ASC')
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
}
