import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IAgentRepository } from './ports/agent.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentEntity } from '@exprealty/database';
import type { Agent, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { AGENT_PROJECTION_CONFIG } from './config/agent-projection.config.js';

/**
 * Query configuration for Agent entity.
 * Defines which fields can be filtered, sorted, and searched.
 * All fields with @Searchable, @Filterable, @Sortable decorators are included.
 */
const AGENT_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: [
		'id', 'agentId', 'title', 'firstName', 'middleName', 'lastName', 'suffix',
		'preferredName', 'birthDate', 'lifecycleStatus', 'systemId', 'seedAgent',
		'joinDate', 'anniversaryDate', 'terminationDate', 'isStaff', 'agentCompanyId',
	],
	allowedSortFields: [
		'id', 'agentId', 'title', 'firstName', 'middleName', 'lastName', 'suffix',
		'preferredName', 'birthDate', 'lifecycleStatus', 'systemId', 'seedAgent',
		'joinDate', 'anniversaryDate', 'terminationDate', 'isStaff', 'agentCompanyId',
		'created', 'lastModified',
	],
	allowedSearchFields: [
		'id', 'agentId', 'title', 'firstName', 'middleName', 'lastName', 'suffix',
		'preferredName', 'lifecycleStatus', 'systemId',
	],
	defaultSort: { field: 'lastName', direction: 'ASC' },
	projectionConfig: AGENT_PROJECTION_CONFIG,
	useStrategySearch: true, // Enable type-aware search for numeric fields
};

/**
 * TypeORM adapter implementing IAgentRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class AgentTypeOrmRepository
	extends BaseTypeOrmRepository<AgentEntity, Agent, string>
	implements IAgentRepository
{
	constructor(
		@InjectRepository(AgentEntity)
		repo: Repository<AgentEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('AgentRepository');
	}

	protected getEntityClass(): new () => AgentEntity {
		return AgentEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return AGENT_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'agent';
	}

	/**
	 * Maps a TypeORM AgentEntity to a domain Agent type.
	 * Note: Uses 'as unknown as Agent' to handle branded type conversions.
	 */
	protected mapToDomain(entity: AgentEntity): Agent {
		const result = {
			id: entity.id,
			agentId: entity.agentId,
			agentCompanyId: entity.agentCompanyId,
			firstName: entity.firstName,
			lastName: entity.lastName,
			preferredName: entity.preferredName,
			suffix: entity.suffix as Agent['suffix'],
			email: '', // TODO: Get from contactMethods
			birthDate: entity.birthDate?.toISOString().split('T')[0] || '',
			lifecycleStatus: entity.lifecycleStatus,
			createdAt: entity.created,
			updatedAt: entity.lastModified,
			// Map optional fields
			...(entity.title && { title: entity.title }),
			...(entity.middleName && { middleName: entity.middleName }),
			...(entity.systemId && { systemId: entity.systemId }),
			...(entity.seedAgent !== undefined && { seedAgent: entity.seedAgent }),
			...(entity.joinDate && { joinDate: entity.joinDate }),
			...(entity.anniversaryDate && { anniversaryDate: entity.anniversaryDate }),
			...(entity.terminationDate && { terminationDate: entity.terminationDate }),
			...(entity.isStaff !== undefined && { isStaff: entity.isStaff }),
			// Map relations if loaded (singular names following GraphQL conventions)
			...(entity.agentCompany && { agentCompany: entity.agentCompany }),
			...(entity.agentOffice && { agentOffice: entity.agentOffice }),
			...(entity.office && { office: entity.office }),
			...(entity.mls && { mls: entity.mls }),
			...(entity.agentAddresses && { agentAddress: entity.agentAddresses }),
			...(entity.externalReferences && { externalReference: entity.externalReferences }),
			...(entity.languages && { language: entity.languages }),
			...(entity.contactMethods && { contactMethod: entity.contactMethods }),
			...(entity.paymentSettings && { paymentSettings: entity.paymentSettings }),
			...(entity.sponsorConfiguration && { sponsorConfiguration: entity.sponsorConfiguration }),
			...(entity.activeLocations && { activeLocation: entity.activeLocations }),
			...(entity.publicProfile && { publicProfile: entity.publicProfile }),
		};
		return result as unknown as Agent;
	}

	/**
	 * Maps domain Agent data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<Agent>): Partial<AgentEntity> {
		const entityData: Partial<AgentEntity> = {};

		if (data.agentCompanyId !== undefined) entityData.agentCompanyId = data.agentCompanyId;
		if (data.firstName !== undefined) entityData.firstName = data.firstName;
		if (data.lastName !== undefined) entityData.lastName = data.lastName;
		if (data.preferredName !== undefined) entityData.preferredName = data.preferredName;
		if (data.suffix !== undefined) entityData.suffix = data.suffix;
		if (data.birthDate !== undefined) entityData.birthDate = new Date(data.birthDate);

		return entityData;
	}

	/**
	 * Finds an agent by email.
	 * Searches through contactMethods for matching email.
	 * Note: Uses 'channel' column which contains 'email' type.
	 */
	async findByEmail(email: string): Promise<Agent | null> {
		const entity = await this.repo
			.createQueryBuilder('agent')
			.leftJoin('agent.contactMethods', 'cm')
			.where('cm.channel = :channel', { channel: 'email' })
			.andWhere('cm.value = :email', { email })
			.getOne();
		return entity ? this.mapToDomain(entity) : null;
	}

	/**
	 * Finds an agent by legacy agent ID.
	 */
	async findByAgentId(agentId: string): Promise<Agent | null> {
		const entity = await this.repo.findOne({
			where: { agentId },
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	/**
	 * Finds agents with pagination, filtering, sorting, and search.
	 */
	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<Agent>> {
		return this.findWithQuery(query, selection);
	}

	// Override create to handle entity mapping
	async create(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
		const entity = this.repo.create({
			...this.mapToEntity(data as Partial<Agent>),
		});
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}
}
