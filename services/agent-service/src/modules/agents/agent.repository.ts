import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
	 * 
	 * TODO: Field projection affects SQL SELECT but mapToDomain always returns full object.
	 * If response filtering is needed, implement post-processing in controller/service layer
	 * or create a separate mapToProjectedDomain(entity, selectedFields) method.
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
			// Use primaryEmail if loaded, otherwise empty
			email: entity.primaryEmail?.value || '',
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
			// Virtual relations - loaded via loadPrimaryContacts()
			...(entity.primaryEmail && { primaryEmail: entity.primaryEmail }),
			...(entity.primaryPhone && { primaryPhone: entity.primaryPhone }),
			// Virtual relation - loaded via loadPrimaryAddress()
			...(entity.primaryAddress && { primaryAddress: entity.primaryAddress }),
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

	// Override create to handle entity mapping
	async create(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
		const entity = this.repo.create({
			...this.mapToEntity(data as Partial<Agent>),
		});
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}

	/**
	 * DRY PRINCIPLE: Reusable method for loading primary contacts
	 * 
	 * Uses TypeORM's leftJoinAndMapOne to join contactMethods with
	 * a filtered condition and map directly to virtual properties.
	 * 
	 * @param qb - Query builder
	 * @param alias - Base entity alias (usually 'agent')
	 * @param types - Contact types to load (e.g., ['email', 'phone'])
	 * 
	 * @example
	 * // Loads primaryEmail and primaryPhone
	 * this.loadPrimaryContacts(qb, 'agent', ['email', 'phone']);
	 * // Results in:
	 * // LEFT JOIN contact_method primaryEmail ON ... AND channel = 'email' AND is_primary = true
	 * // LEFT JOIN contact_method primaryPhone ON ... AND channel = 'phone' AND is_primary = true
	 */
	protected loadPrimaryContacts<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
		types: string[],
	): void {
		for (const type of types) {
			// Build relation alias: email -> primaryEmail, phone -> primaryPhone
			const relationAlias = `primary${type.charAt(0).toUpperCase() + type.slice(1)}`;

			// Use leftJoinAndMapOne to:
			// 1. Join contactMethods with filtered condition
			// 2. Map result directly to virtual property (entity.primaryEmail)
			qb.leftJoinAndMapOne(
				`${alias}.${relationAlias}`,      // Maps to entity.primaryEmail / entity.primaryPhone
				`${alias}.contactMethods`,         // Source relation
				relationAlias,                     // Alias for the join
				`${relationAlias}.channel = :${relationAlias}Channel AND ${relationAlias}.isPrimary = true`,
				{ [`${relationAlias}Channel`]: type },
			);
		}
	}

	/**
	 * Loads the primary address for an agent.
	 * Uses leftJoinAndMapOne to join agentAddresses with isPrimary = true filter.
	 * Also loads the nested address entity.
	 */
	protected loadPrimaryAddress<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
	): void {
		// Join agent_address where isPrimary = true
		qb.leftJoinAndMapOne(
			`${alias}.primaryAddress`,
			`${alias}.agentAddresses`,
			'primaryAddress',
			'primaryAddress.isPrimary = true',
		);

		// Also join the nested address entity
		qb.leftJoinAndSelect('primaryAddress.address', 'primaryAddressDetails');
	}

	/**
	 * Extract primary contact types from includes.
	 * Detects primaryEmail, primaryPhone, etc. in the includes array.
	 * 
	 * @returns Array of contact types (e.g., ['email', 'phone'])
	 */
	private extractPrimaryContactTypes(include?: string[]): string[] {
		if (!include) return [];

		const primaryContactTypes: string[] = [];
		for (const item of include) {
			if (item.startsWith('primary') && item !== 'primaryAddress') {
				// primaryEmail -> email, primaryPhone -> phone
				const type = item.replace('primary', '').toLowerCase();
				if (type) primaryContactTypes.push(type);
			}
		}
		return primaryContactTypes;
	}

	/**
	 * Check if primaryAddress is requested in includes.
	 */
	private hasPrimaryAddressInclude(include?: string[]): boolean {
		return include?.includes('primaryAddress') ?? false;
	}

	/**
	 * Finds agents with pagination, filtering, sorting, and search.
	 * Handles primary contact and address loading via custom joins.
	 */
	async findPage(
		query: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<Agent>> {
		const primaryContactTypes = this.extractPrimaryContactTypes(selection?.include);
		const hasPrimaryAddress = this.hasPrimaryAddressInclude(selection?.include);

		if (primaryContactTypes.length > 0 || hasPrimaryAddress) {
			// Use customizeQuery callback to add primary contact/address joins
			return this.findWithQuery(query, selection, (qb) => {
				if (primaryContactTypes.length > 0) {
					this.loadPrimaryContacts(qb, this.getAlias(), primaryContactTypes);
				}
				if (hasPrimaryAddress) {
					this.loadPrimaryAddress(qb, this.getAlias());
				}
			});
		}

		return this.findWithQuery(query, selection);
	}
}
