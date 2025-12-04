import type { ProjectionConfig, QueryParams, NormalizedQueryParams } from '@exprealty/shared-domain'
import type { Repository, ObjectLiteral, SelectQueryBuilder } from 'typeorm'
import type { QueryService } from '../query/query.service.js'
import type { LoggerService } from '../../core/logger.service.js'
import { FieldSelection } from '@exprealty/shared-domain'
import { ProjectionService } from '../query/projection.service.js'

import { 
  CursorPaginationSchema, 
  CursorPaginationResponseSchema,
  type CursorPagination,
  type CursorPageResult
} from '@exprealty/shared-domain'
/**
 * Configuration for query capabilities on an entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
export interface BaseQueryConfig {
	/** Fields that can be used in filter conditions */
	allowedFilterFields: string[]
	/** Fields that can be used for sorting */
	allowedSortFields: string[]
	/** Fields that can be searched with text queries */
	allowedSearchFields: string[]
    /** Configuration for field projections */
    projectionConfig?: ProjectionConfig
	/** Default sort field and direction */
	defaultSort?: { field: string; direction: 'ASC' | 'DESC' }
    
}

/**
 * Generic repository interface defining standard CRUD operations.
 * Domain-focused contract that abstracts away persistence details.
 */
export interface IRepository<T, ID = string> {
	findAll(params: Partial<QueryParams>): Promise<{ items: T[]; total: number }>
	findById(id: ID): Promise<T | null>
	create(data: Omit<T, 'id'>): Promise<T>
	update(id: ID, data: Partial<T>): Promise<T>
	delete(id: ID): Promise<void>
}

/**
 * Abstract base class for TypeORM repositories.
 * Provides common CRUD operations while allowing entity-specific customizations.
 * 
 * Uses composition over inheritance - wraps a TypeORM Repository
 * rather than extending it to avoid constructor complexity.
 * 
 * @typeParam TEntity - The TypeORM entity type
 * @typeParam TDomain - The domain model type (may differ from entity)
 * @typeParam ID - The ID type (defaults to string)
 */
export abstract class BaseTypeOrmRepository<
	TEntity extends ObjectLiteral,
	TDomain,
	ID = string,
> implements IRepository<TDomain, ID>
{
	constructor(
		protected readonly repo: Repository<TEntity>,
		protected readonly queryService: QueryService,
		protected readonly logger: LoggerService,
        protected readonly projectionService: ProjectionService
	) {}

	/**
	 * Maps a TypeORM entity to a domain model.
	 * Override in subclasses to customize mapping.
	 */
	protected abstract mapToDomain(entity: TEntity): TDomain

	/**
	 * Maps domain data to entity data for persistence.
	 * Override in subclasses to customize mapping.
	 */
	protected abstract mapToEntity(data: Partial<TDomain>): Partial<TEntity>

	/**
	 * Gets the entity class for query building.
	 * Override in subclasses to return the entity class.
	 */
	protected abstract getEntityClass(): new () => TEntity

	/**
	 * Returns the query configuration for this repository.
	 * Defines allowed filter, sort, and search fields.
	 * Override in subclasses to customize.
	 */
	protected abstract getQueryConfig(): BaseQueryConfig

	/**
	 * Gets the alias used in query builder (defaults to 'entity').
	 * Override in subclasses to customize.
	 */
	protected getAlias(): string {
		return 'entity'
	}

	async findById(id: ID): Promise<TDomain | null> {
		const entity = await this.repo.findOne({ where: { id } as any })
		return entity ? this.mapToDomain(entity) : null
	}

	/**
	 * Executes a query with filtering, sorting, searching, and pagination.
	 * Shared utility method that applies QueryConfig constraints.
	 * 
	 * @param params - Query parameters (filter, sort, search, pagination)
	 * @param customizeQuery - Optional callback to customize the query builder
	 * @returns Paginated results with items and total count
	 */
	protected async findWithQuery(
		params: Partial<QueryParams>,
        selection?: FieldSelection,
		customizeQuery?: (qb: SelectQueryBuilder<TEntity>) => void,
	): Promise<{ items: TDomain[]; total: number }> {
		const entityClass = this.getEntityClass()
		const alias = this.getAlias()
		const config = this.getQueryConfig()

		// Normalize and validate query params using entity decorators
		const normalized = this.queryService.normalizeWithValidation(params, entityClass)

		// Create query builder
		const qb = this.repo.createQueryBuilder(alias)

        if(config.projectionConfig && selection){
            
            this.projectionService.applyProjection(
                qb,
                alias,
                selection,
                config.projectionConfig
            );

            this.projectionService.applyRelations(
                qb,
                alias,
                selection,
                config.projectionConfig
            );
        }
		// Apply custom query modifications if provided
		if (customizeQuery) {
			customizeQuery(qb)
		}

		// Apply filters, search, and sorting via QueryService
		this.queryService.applyAll(qb, normalized, alias)

		// Apply default sort if no sort specified
		if ((!normalized.sort || normalized.sort.conditions.length === 0) && config.defaultSort) {
			qb.orderBy(`${alias}.${config.defaultSort.field}`, config.defaultSort.direction)
		}

		// Apply pagination
		qb.skip(normalized.offset).take(normalized.limit)

		// Execute query
		const [entities, total] = await qb.getManyAndCount()

		return {
			items: entities.map((e) => this.mapToDomain(e)),
			total,
		}
	}

	/**
	 * Find with cursor pagination + projection.
	 * Uses a cursor field (e.g., 'id', 'created') for efficient pagination.
	 * 
	 * @param cursorField - The entity field to use as cursor
	 * @param cursor - Current cursor value (undefined for first page)
	 * @param limit - Number of items per page
	 * @param params - Normalized query parameters for filtering/sorting/searching
	 * @param selection - Optional field selection for projection
	 * @returns Cursor-paginated results with navigation cursors
	 */
	protected async findWithCursor<K extends keyof TEntity & string>(
		cursorField: K,
		cursor: TEntity[K] | undefined,
		limit: number,
		params: NormalizedQueryParams,
		selection?: FieldSelection,
	): Promise<CursorPageResult<TDomain, TEntity[K]>> {
		const entityAlias = this.getAlias()
		const config = this.getQueryConfig()

		const qb = this.repo.createQueryBuilder(entityAlias)

		// Apply projection if configured
		if (config.projectionConfig && selection) {
			this.projectionService.applyProjection(
				qb,
				entityAlias,
				selection,
				config.projectionConfig,
			)

			this.projectionService.applyRelations(
				qb,
				entityAlias,
				selection,
				config.projectionConfig,
			)
		}

		// Apply cursor condition
		if (cursor !== undefined) {
			qb.andWhere(`${entityAlias}.${cursorField} > :cursor`, { cursor })
		}

		// Apply filters, sort, search
		this.queryService.applyAll(qb, params, entityAlias)

		// Order by cursor field for consistent pagination
		qb.orderBy(`${entityAlias}.${cursorField}`, 'ASC')

		// Fetch limit + 1 to detect hasNext
		qb.take(limit + 1)

		const entities = await qb.getMany()

		const hasNext = entities.length > limit
		const hasPrev = cursor !== undefined

		// Remove the extra item used for hasNext detection
		if (hasNext) {
			entities.pop()
		}

		// Map entities to domain models
		const items = entities.map((e) => this.mapToDomain(e))

		// Extract cursors from entities
		const nextCursor = hasNext && entities.length > 0
			? entities[entities.length - 1][cursorField]
			: null

		const prevCursor = entities.length > 0 && cursor !== undefined
			? entities[0][cursorField]
			: null

		return {
			items,
			nextCursor,
			prevCursor,
			hasNext,
			hasPrev,
		}
	}


	async findAll(params: Partial<QueryParams>): Promise<{ items: TDomain[]; total: number }> {
		return this.findWithQuery(params)
	}

	async create(data: Omit<TDomain, 'id'>): Promise<TDomain> {
		const entityData = this.mapToEntity(data as Partial<TDomain>)
		const entity = this.repo.create(entityData as TEntity)
		const saved = await this.repo.save(entity)
		return this.mapToDomain(saved)
	}

	async update(id: ID, data: Partial<TDomain>): Promise<TDomain> {
		const entityData = this.mapToEntity(data)
		await this.repo.update({ id } as any, entityData)
		const updated = await this.repo.findOne({ where: { id } as any })
		if (!updated) {
			throw new Error(`Entity with id ${id} not found after update`)
		}
		return this.mapToDomain(updated)
	}

	async delete(id: ID): Promise<void> {
		await this.repo.delete({ id } as any)
	}
}