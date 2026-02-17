import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { ILineOfBusinessRepository } from './ports/line-of-business.repository.port.js'
import type { PageResult } from '../../common/ports/pagination.types.js'
import { LineOfBusinessEntity } from '@exprealty/database'
import type { LineOfBusiness, QueryParams, FieldSelection } from '@exprealty/shared-domain'
import { QueryService } from '../../common/query/query.service.js'
import { LoggerService } from '../../core/logger.service.js'
import { ProjectionService } from '../../common/query/projection.service.js'
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js'

/**
 * Query configuration for LineOfBusiness entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const LINE_OF_BUSINESS_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'name'],
	allowedSortFields: ['id', 'name', 'created', 'lastModified'],
	allowedSearchFields: ['id', 'name'],
	defaultSort: { field: 'name', direction: 'ASC' },
	useStrategySearch: true,
}

/**
 * TypeORM adapter implementing ILineOfBusinessRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 */
@Injectable()
export class LineOfBusinessTypeOrmRepository
	extends BaseTypeOrmRepository<LineOfBusinessEntity, LineOfBusiness>
	implements ILineOfBusinessRepository
{
	constructor(
		@InjectRepository(LineOfBusinessEntity)
		repo: Repository<LineOfBusinessEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService)
		this.logger.setContext('LineOfBusinessRepository')
	}

	protected getEntityClass(): new () => LineOfBusinessEntity {
		return LineOfBusinessEntity
	}

	protected getQueryConfig(): BaseQueryConfig {
		return LINE_OF_BUSINESS_QUERY_CONFIG
	}

	protected getAlias(): string {
		return 'lineOfBusiness'
	}

	/**
	 * Maps a TypeORM LineOfBusinessEntity to a domain LineOfBusiness type.
	 */
	protected mapToDomain(entity: LineOfBusinessEntity): LineOfBusiness {
		return {
			id: String(entity.id),
			name: entity.name,
			created: entity.created,
			lastModified: entity.lastModified,
			modifiedBy: entity.modifiedBy,
		}
	}

	/**
	 * Maps domain LineOfBusiness data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<LineOfBusiness>): Partial<LineOfBusinessEntity> {
		const entityData: Partial<LineOfBusinessEntity> = {}

		if (data.name !== undefined) entityData.name = data.name
		if (data.modifiedBy !== undefined) entityData.modifiedBy = data.modifiedBy

		return entityData
	}

	// -------------------------------------------------------------------------
	// ILineOfBusinessRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findByName(name: string): Promise<LineOfBusiness | null> {
		const entity = await this.repo.findOne({ where: { name } })
		return entity ? this.mapToDomain(entity) : null
	}

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<LineOfBusiness>> {
		return this.findWithQuery(query, selection)
	}
}
