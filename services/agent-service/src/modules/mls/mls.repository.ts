import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IMLSRepository } from './ports/mls.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { MLSEntity } from '@exprealty/database';
import type { MLSType, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { MLS_PROJECTION_CONFIG } from './config/mls-projection.config.js';

/**
 * Query configuration for MLS entity.
 * Defines which fields can be filtered, sorted, and searched.
 * All fields with @Searchable, @Filterable, @Sortable decorators are included.
 */
const MLS_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'ouid', 'globalId', 'lifecycleStatus', 'name', 'shortName', 'website', 'orgType', 'kunversionUrl', 'addressId'],
	allowedSortFields: ['id', 'ouid', 'globalId', 'lifecycleStatus', 'name', 'shortName', 'website', 'orgType', 'kunversionUrl', 'addressId', 'created', 'lastModified'],
	allowedSearchFields: ['id', 'ouid', 'globalId', 'lifecycleStatus', 'name', 'shortName', 'website', 'orgType', 'kunversionUrl', 'addressId'],
	defaultSort: { field: 'name', direction: 'ASC' },
	projectionConfig: MLS_PROJECTION_CONFIG,
	useStrategySearch: true, // Enable type-aware search for numeric fields
};

/**
 * TypeORM adapter implementing IMLSRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class MLSTypeOrmRepository
	extends BaseTypeOrmRepository<MLSEntity, MLSType, string>
	implements IMLSRepository
{
	constructor(
		@InjectRepository(MLSEntity)
		repo: Repository<MLSEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('MLSRepository');
	}

	protected getEntityClass(): new () => MLSEntity {
		return MLSEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return MLS_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'mls';
	}

	/**
	 * Maps a TypeORM MLSEntity to a domain MLS type.
	 */
	protected mapToDomain(entity: MLSEntity): MLSType {
		return {
			id: entity.id,
			ouid: entity.ouid,
			globalId: entity.globalId,
			lifecycleStatus: entity.lifecycleStatus as MLSType['lifecycleStatus'],
			name: entity.name,
			shortName: entity.shortName,
			website: entity.website,
			orgType: entity.orgType as MLSType['orgType'],
			kunversionUrl: entity.kunversionUrl,
			addressId: entity.addressId,
			created: entity.created as MLSType['created'],
			lastModified: entity.lastModified as MLSType['lastModified'],
			modifiedBy: entity.modifiedBy,
			// Map address relation
			address: entity.address ? {
				...entity.address,
				id: String(entity.address.id),
			} : undefined,
			agent: entity.agents,
		};
	}

	/**
	 * Maps domain MLS data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<MLSType>): Partial<MLSEntity> {
		const entityData: Partial<MLSEntity> = {};

		if (data.ouid !== undefined) entityData.ouid = data.ouid;
		if (data.globalId !== undefined) entityData.globalId = data.globalId;
		if (data.lifecycleStatus !== undefined) entityData.lifecycleStatus = data.lifecycleStatus;
		if (data.name !== undefined) entityData.name = data.name;
		if (data.shortName !== undefined) entityData.shortName = data.shortName;
		if (data.website !== undefined) entityData.website = data.website;
		if (data.orgType !== undefined) entityData.orgType = data.orgType;
		if (data.kunversionUrl !== undefined) entityData.kunversionUrl = data.kunversionUrl;
		if (data.addressId !== undefined) entityData.addressId = data.addressId;
		if (data.modifiedBy !== undefined) entityData.modifiedBy = data.modifiedBy;

		return entityData;
	}

	/**
	 * Finds an MLS by name.
	 */
	async findByName(name: string): Promise<MLSType | null> {
		const entity = await this.repo.findOne({
			where: { name },
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	/**
	 * Finds an MLS by global ID.
	 */
	async findByGlobalId(globalId: number): Promise<MLSType | null> {
		const entity = await this.repo.findOne({
			where: { globalId },
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	/**
	 * Finds MLS records with pagination, filtering, sorting, and search.
	 */
	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<MLSType>> {
		return this.findWithQuery(query, selection);
	}

	// Override create to handle entity mapping
	async create(data: Omit<MLSType, 'id' | 'created' | 'lastModified' | 'modifiedBy'>): Promise<MLSType> {
		const entity = this.repo.create({
			...this.mapToEntity(data as Partial<MLSType>),
		});
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}
}
