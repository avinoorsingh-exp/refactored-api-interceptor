import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IAgentCompanyAssociationRepository } from './ports/agent-company-association.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentCompanyAssociationEntity } from '@exprealty/database';
import type { AgentCompanyAssociation, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { AGENT_COMPANY_ASSOCIATION_PROJECTION_CONFIG } from './config/agent-company-association-projection.config.js';

/**
 * Query configuration for AgentCompanyAssociation entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const AGENT_COMPANY_ASSOCIATION_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'agentId', 'agentCompanyId', 'isPrimary'],
	allowedSortFields: ['id', 'agentId', 'agentCompanyId', 'isPrimary'],
	allowedSearchFields: ['agentId', 'agentCompanyId'],
	defaultSort: { field: 'id', direction: 'ASC' },
	projectionConfig: AGENT_COMPANY_ASSOCIATION_PROJECTION_CONFIG,
	useStrategySearch: true,
};

/**
 * TypeORM adapter implementing IAgentCompanyAssociationRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class AgentCompanyAssociationTypeOrmRepository
	extends BaseTypeOrmRepository<AgentCompanyAssociationEntity, AgentCompanyAssociation>
	implements IAgentCompanyAssociationRepository
{
	constructor(
		@InjectRepository(AgentCompanyAssociationEntity)
		repo: Repository<AgentCompanyAssociationEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('AgentCompanyAssociationRepository');
	}

	protected getEntityClass(): new () => AgentCompanyAssociationEntity {
		return AgentCompanyAssociationEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return AGENT_COMPANY_ASSOCIATION_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'agent_company_association';
	}

	/**
	 * Maps a TypeORM AgentCompanyAssociationEntity to a domain type.
	 */
	protected mapToDomain(entity: AgentCompanyAssociationEntity): AgentCompanyAssociation {
		return {
			id: entity.id,
			agentId: entity.agentId,
			agentCompanyId: entity.agentCompanyId,
			isPrimary: entity.isPrimary,
			agent: entity.agent,
			agentCompany: entity.agentCompany,
		};
	}

	/**
	 * Maps domain data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<AgentCompanyAssociation>): Partial<AgentCompanyAssociationEntity> {
		const entityData: Partial<AgentCompanyAssociationEntity> = {};

		if (data.agentId !== undefined) entityData.agentId = data.agentId;
		if (data.agentCompanyId !== undefined) entityData.agentCompanyId = data.agentCompanyId;
		if (data.isPrimary !== undefined) entityData.isPrimary = data.isPrimary;

		return entityData;
	}

	// -------------------------------------------------------------------------
	// IAgentCompanyAssociationRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<AgentCompanyAssociation>> {
		return this.findWithQuery(query, selection);
	}

	async findByAgentId(agentId: string): Promise<AgentCompanyAssociation[]> {
		const entities = await this.repo.find({
			where: { agentId },
			relations: ['agentCompany'],
		});
		return entities.map((entity) => this.mapToDomain(entity));
	}

	async findByAgentAndCompany(agentId: string, agentCompanyId: string): Promise<AgentCompanyAssociation | null> {
		const entity = await this.repo.findOne({
			where: { agentId, agentCompanyId },
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	async findPrimaryByAgentId(agentId: string): Promise<AgentCompanyAssociation | null> {
		const entity = await this.repo.findOne({
			where: { agentId, isPrimary: true },
			relations: ['agentCompany'],
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	async clearPrimaryForAgent(agentId: string): Promise<void> {
		await this.repo.update(
			{ agentId, isPrimary: true },
			{ isPrimary: false },
		);
	}
}
