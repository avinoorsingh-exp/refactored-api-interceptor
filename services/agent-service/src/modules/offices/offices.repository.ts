import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IOfficesRepository } from './ports/offices.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { OfficeEntity } from '@exprealty/database';
import type { Office, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { OFFICES_PROJECTION_CONFIG } from './config/offices-projection.config.js';

/**
 * Query configuration for Office entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const OFFICES_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'name', 'phone', 'lifecycleStatus', 'primaryState', 'companyId', 'website'],
	allowedSortFields: ['id', 'name', 'phone', 'lifecycleStatus', 'primaryState', 'companyId', 'created', 'lastModified'],
	allowedSearchFields: ['id', 'name', 'phone', 'primaryState', 'website', 'companyId'],
	defaultSort: { field: 'id', direction: 'ASC' },
	projectionConfig: OFFICES_PROJECTION_CONFIG,
	useStrategySearch: true, // Enable type-aware search for numeric fields
};

/**
 * TypeORM adapter implementing IOfficesRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class OfficesTypeOrmRepository
	extends BaseTypeOrmRepository<OfficeEntity, Office>
	implements IOfficesRepository
{
	constructor(
		@InjectRepository(OfficeEntity)
		repo: Repository<OfficeEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('OfficesRepository');
	}

	protected getEntityClass(): new () => OfficeEntity {
		return OfficeEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return OFFICES_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'office';
	}

	/**
	 * Maps a TypeORM OfficeEntity to a domain Office type.
	 */
	protected mapToDomain(entity: OfficeEntity): Office {
		return {
			id: entity.id,
			website: entity.website as Office['website'],
			name: entity.name,
			phone: entity.phone,
			lifecycleStatus: entity.lifecycleStatus,
			primaryState: entity.primaryState,
			companyId: entity.companyId,
			created: entity.created,
			lastModified: entity.lastModified,
			modifiedBy: entity.modifiedBy,
			// Map company relation - spread all fields, override BigInt id for JSON serialization
			company: entity.company ? {
				...entity.company,
				id: String(entity.company.id),
			} : undefined,
			agentOffice: entity.agentOffice,
			agents: entity.agents,
			officeExternalReferences: entity.officeExternalReferences,
		};
	}

	/**
	 * Maps domain Office data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<Office>): Partial<OfficeEntity> {
		const entityData: Partial<OfficeEntity> = {};

		if (data.website !== undefined) entityData.website = data.website ?? undefined;
		if (data.name !== undefined) entityData.name = data.name;
		if (data.phone !== undefined) entityData.phone = data.phone;
		if (data.lifecycleStatus !== undefined) entityData.lifecycleStatus = data.lifecycleStatus;
		if (data.primaryState !== undefined) entityData.primaryState = data.primaryState;
		if (data.companyId !== undefined) entityData.companyId = data.companyId;
		if (data.modifiedBy !== undefined) entityData.modifiedBy = data.modifiedBy;

		return entityData;
	}

	// -------------------------------------------------------------------------
	// IOfficesRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findByName(name: string): Promise<Office | null> {
		const entity = await this.repo.findOne({ where: { name } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByCompanyId(companyId: string): Promise<Office[]> {
		const entities = await this.repo.find({ where: { companyId } });
		return entities.map(entity => this.mapToDomain(entity));
	}

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<Office>> {
		return this.findWithQuery(query, selection);
	}

	// Override create to handle entity mapping
	async create(data: Omit<Office, 'id' | 'created' | 'lastModified' | 'modifiedBy'>): Promise<Office> {
		const entity = this.repo.create({
			...this.mapToEntity(data as Partial<Office>),
		});
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}
}
