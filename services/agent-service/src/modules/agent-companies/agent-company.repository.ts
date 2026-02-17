import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IAgentCompanyRepository } from './ports/agent-company.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentCompanyEntity } from '@exprealty/database';
import type { AgentCompany, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { AGENT_COMPANY_PROJECTION_CONFIG } from './config/agent-company-projection.config.js';

/**
 * Query configuration for AgentCompany entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const AGENT_COMPANY_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'legacyId', 'name', 'email', 'useSsn'],
	allowedSortFields: ['id', 'name', 'email', 'created', 'lastModified'],
	allowedSearchFields: ['name', 'email', 'legacyId'],
	defaultSort: { field: 'name', direction: 'ASC' },
	projectionConfig: AGENT_COMPANY_PROJECTION_CONFIG,
	useStrategySearch: true,
};

/**
 * TypeORM adapter implementing IAgentCompanyRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 */
@Injectable()
export class AgentCompanyTypeOrmRepository
	extends BaseTypeOrmRepository<AgentCompanyEntity, AgentCompany>
	implements IAgentCompanyRepository
{
	constructor(
		@InjectRepository(AgentCompanyEntity)
		repo: Repository<AgentCompanyEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('AgentCompanyRepository');
	}

	protected getEntityClass(): new () => AgentCompanyEntity {
		return AgentCompanyEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return AGENT_COMPANY_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'agent_company';
	}

	/**
	 * Maps a TypeORM AgentCompanyEntity to a domain type.
	 * Builds the masked display value from taxIdLast4.
	 * Uses type assertion for branded types since entity data is already validated.
	 */
	protected mapToDomain(entity: AgentCompanyEntity): AgentCompany {
		return {
			id: entity.id,
			legacyId: entity.legacyId,
			name: entity.name,
			email: entity.email,
			phone: entity.phone,
			taxId: entity.taxIdLast4 ? '*****' + entity.taxIdLast4 : null,
			taxIdToken: entity.taxIdHashed ?? null,
			useSsn: entity.useSsn,
			createdAt: entity.created,
			updatedAt: entity.lastModified,
		} as AgentCompany;
	}

	/**
	 * Maps domain data to entity data for persistence.
	 * Tax ID fields (taxIdLast4, taxIdToken) are pre-computed by the service layer.
	 */
	protected mapToEntity(data: Partial<AgentCompany>): Partial<AgentCompanyEntity> {
		const entityData: Partial<AgentCompanyEntity> = {};
		const raw = data as any;

		if (data.legacyId !== undefined) entityData.legacyId = data.legacyId;
		if (data.name !== undefined) entityData.name = data.name;
		if (data.email !== undefined) entityData.email = data.email;
		if (data.phone !== undefined) entityData.phone = data.phone;
		if (raw.taxIdLast4 !== undefined) entityData.taxIdLast4 = raw.taxIdLast4;
		if (raw.taxIdToken !== undefined) entityData.taxIdHashed = raw.taxIdToken;
		if (data.useSsn !== undefined) entityData.useSsn = data.useSsn;

		return entityData;
	}

	// -------------------------------------------------------------------------
	// IAgentCompanyRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<AgentCompany>> {
		return this.findWithQuery(query, selection);
	}

	async findByName(name: string): Promise<AgentCompany | null> {
		const entity = await this.repo.findOne({ where: { name } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByLegacyId(legacyId: string): Promise<AgentCompany | null> {
		const entity = await this.repo.findOne({ where: { legacyId } });
		return entity ? this.mapToDomain(entity) : null;
	}
}
