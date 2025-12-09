import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IStatesRepository } from './ports/states.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { StateEntity } from '@exprealty/database';
import type { State, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { STATES_PROJECTION_CONFIG } from './config/states-projection.config.js';

/**
 * Query configuration for States entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const STATES_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'name', 'code', 'isActive', 'regionId', 'countryId'],
	allowedSortFields: ['name', 'code', 'created', 'lastModified'],
	allowedSearchFields: ['name', 'code', 'regionId', 'countryId'],
	defaultSort: { field: 'name', direction: 'ASC' },
	projectionConfig: STATES_PROJECTION_CONFIG,
	useStrategySearch: true, // Enable type-aware search for numeric fields (regionId, countryId)
};

/**
 * TypeORM adapter implementing IStatesRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class StatesTypeOrmRepository
	extends BaseTypeOrmRepository<StateEntity, State, string>
	implements IStatesRepository
{
	constructor(
		@InjectRepository(StateEntity)
		repo: Repository<StateEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('StatesRepository');
	}

	protected getEntityClass(): new () => StateEntity {
		return StateEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return STATES_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'state';
	}

	/**
	 * Maps a TypeORM StateEntity to a domain State type.
	 */
	protected mapToDomain(entity: StateEntity): State {
		return {
			id: entity.id,
			name: entity.name,
			code: entity.code,
			isActive: entity.isActive,
			email: entity.email as State['email'],
			signatureDistributionEmail: entity.signatureDistributionEmail as State['signatureDistributionEmail'],
			regionId: String(entity.regionId),
			countryId: entity.countryId,
			created: entity.created as State['created'],
			lastModified: entity.lastModified as State['lastModified'],
			modifiedBy: entity.modifiedBy,
			region: entity.region ? { id: entity.region.id, name: entity.region.name } : undefined,
			country: entity.country ? { id: entity.country.id, name: entity.country.name, alpha2: entity.country.alpha2, alpha3: entity.country.alpha3 } : undefined,
			statePrograms: entity.statePrograms,
		};
	}

	/**
	 * Maps domain State data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<State>): Partial<StateEntity> {
		const entityData: Partial<StateEntity> = {};

		if (data.name !== undefined) entityData.name = data.name;
		if (data.code !== undefined) entityData.code = data.code;
		if (data.isActive !== undefined) entityData.isActive = data.isActive;
		if (data.email !== undefined) entityData.email = data.email;
		if (data.signatureDistributionEmail !== undefined) entityData.signatureDistributionEmail = data.signatureDistributionEmail;
		if (data.modifiedBy !== undefined) entityData.modifiedBy = data.modifiedBy;
		if (data.regionId !== undefined) entityData.regionId = BigInt(data.regionId);
		if (data.countryId !== undefined) entityData.countryId = data.countryId;

		return entityData;
	}

	// -------------------------------------------------------------------------
	// IStatesRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findByCode(code: string): Promise<State | null> {
		const entity = await this.repo.findOne({ where: { code } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByRegionId(regionId: string): Promise<State[]> {
		const entities = await this.repo.find({
			where: { regionId: BigInt(regionId) },
		});
		return entities.map((e) => this.mapToDomain(e));
	}

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<State>> {
		return this.findWithQuery(query, selection);
	}

	// Override create to handle regionId BigInt conversion
	async create(data: Omit<State, 'id' | 'created' | 'lastModified' | 'modifiedBy'>): Promise<State> {
		const entity = this.repo.create({
			...this.mapToEntity(data as Partial<State>),
			regionId: BigInt(data.regionId),
		});
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}
}
