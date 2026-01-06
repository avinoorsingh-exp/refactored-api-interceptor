import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { IAgentRepository } from './ports/agent.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentEntity, AddressEntity } from '@exprealty/database';
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
	 * All scalar fields are always included to ensure consistent API responses.
	 * Relations are only included if they were loaded (via ?include=).
	 */
	protected mapToDomain(entity: AgentEntity): Agent {
		const result: Record<string, unknown> = {
			// Primary key
			id: entity.id,
			agentId: entity.agentId,

			// Required fields
			firstName: entity.firstName,
			lastName: entity.lastName,
			lifecycleStatus: entity.lifecycleStatus,

			// Optional string fields (always include, even if null/undefined)
			agentCompanyId: entity.agentCompanyId ?? null,
			title: entity.title ?? null,
			middleName: entity.middleName ?? null,
			suffix: entity.suffix ?? null,
			preferredName: entity.preferredName ?? null,

			// Optional numeric fields
			systemId: entity.systemId ?? null,

			// Optional boolean fields (always include with their actual value)
			seedAgent: entity.seedAgent ?? false,
			isStaff: entity.isStaff ?? false,

			// Optional date fields (format as ISO string or null)
			birthDate: entity.birthDate?.toISOString() ?? null,
			joinDate: entity.joinDate?.toISOString() ?? null,
			anniversaryDate: entity.anniversaryDate?.toISOString() ?? null,
			terminationDate: entity.terminationDate?.toISOString() ?? null,

			// Audit fields
			created: entity.created?.toISOString() ?? null,
			lastModified: entity.lastModified?.toISOString() ?? null,
			modifiedBy: (entity as any).modifiedBy ?? null,
			mxid: (entity as any).mxid ?? null,
		};

		// Map relations only if loaded (singular names following GraphQL conventions)
		if (entity.agentCompany) result.agentCompany = entity.agentCompany;
		if (entity.agentOffice) result.agentOffice = entity.agentOffice;
		if (entity.office) result.office = entity.office;
		if (entity.mls) result.mls = entity.mls;
		if (entity.addresses) result.address = entity.addresses;
		if (entity.agentAddresses) result.agentAddress = entity.agentAddresses;
		if (entity.externalReferences) result.externalReference = entity.externalReferences;
		if (entity.languages) result.language = entity.languages;
		if (entity.contactMethods) result.contactMethod = entity.contactMethods;
		if (entity.paymentSettings) result.paymentSettings = entity.paymentSettings;
		if (entity.sponsorConfiguration) result.sponsorConfiguration = entity.sponsorConfiguration;
		if (entity.activeLocations) result.activeLocation = entity.activeLocations;
		if (entity.publicProfile) result.publicProfile = entity.publicProfile;

		// Virtual relations - loaded via loadPrimaryContacts()
		if (entity.primaryEmail) result.primaryEmail = entity.primaryEmail;
		if (entity.primaryPhone) result.primaryPhone = entity.primaryPhone;

		// Virtual relation - loaded via loadPrimaryAddress()
		if (entity.primaryAddress) result.primaryAddress = entity.primaryAddress;

		return result as unknown as Agent;
	}

	/**
	 * Maps domain Agent data to entity data for persistence.
	 * Maps all scalar fields from the domain model to the entity.
	 */
	protected mapToEntity(data: Partial<Agent>): Partial<AgentEntity> {
		const entityData: Partial<AgentEntity> = {};

		// Required fields
		if (data.firstName !== undefined) entityData.firstName = data.firstName;
		if (data.lastName !== undefined) entityData.lastName = data.lastName;
		if (data.lifecycleStatus !== undefined) entityData.lifecycleStatus = data.lifecycleStatus as AgentEntity['lifecycleStatus'];

		// Optional string fields
		if (data.agentCompanyId !== undefined) entityData.agentCompanyId = data.agentCompanyId ?? undefined;
		if (data.title !== undefined) entityData.title = data.title as AgentEntity['title'];
		if (data.middleName !== undefined) entityData.middleName = data.middleName;
		if (data.suffix !== undefined) entityData.suffix = data.suffix;
		if (data.preferredName !== undefined) entityData.preferredName = data.preferredName;

		// Optional numeric fields
		if (data.systemId !== undefined) entityData.systemId = data.systemId;

		// Optional boolean fields
		if (data.seedAgent !== undefined) entityData.seedAgent = data.seedAgent;
		if (data.isStaff !== undefined) entityData.isStaff = data.isStaff;

		// Optional date fields
		if (data.birthDate !== undefined) entityData.birthDate = data.birthDate ? new Date(data.birthDate) : undefined;
		if (data.joinDate !== undefined) entityData.joinDate = data.joinDate ? new Date(data.joinDate) : undefined;
		if (data.anniversaryDate !== undefined) entityData.anniversaryDate = data.anniversaryDate ? new Date(data.anniversaryDate) : undefined;
		if (data.terminationDate !== undefined) entityData.terminationDate = data.terminationDate ? new Date(data.terminationDate) : undefined;

		// Audit fields (from AuditableEntity)
		if ((data as any).mxid !== undefined) (entityData as any).mxid = (data as any).mxid;
		if ((data as any).modifiedBy !== undefined) (entityData as any).modifiedBy = (data as any).modifiedBy;

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
	 * Uses two LEFT JOINs: first to junction table, then to address.
	 * Maps address directly to entity.primaryAddress (like loadPrimaryContacts).
	 * Uses addSelect to ensure fields are in DISTINCT query.
	 */
	protected loadPrimaryAddress<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
	): void {
		const junctionAlias = 'primaryAddressJunction';
		const addressAlias = 'primaryAddress';

		// LEFT JOIN to junction table with isPrimary = true filter
		qb.leftJoin(
			`${alias}.agentAddresses`,
			junctionAlias,
			`${junctionAlias}.isPrimary = true`,
		);

		// LEFT JOIN and map the address directly to entity.primaryAddress
		// Uses leftJoinAndMapOne to map the nested address relation
		qb.leftJoin(`${junctionAlias}.address`, addressAlias)

		// Explicitly select address fields with addSelect
		// This ensures they're included in the outer DISTINCT query
		qb.addSelect([
			`${addressAlias}.id`,
			`${addressAlias}.line1`,
			`${addressAlias}.line2`,
			`${addressAlias}.city`,
			`${addressAlias}.stateId`,
			`${addressAlias}.postalCode`,
			`${addressAlias}.county`,
			`${addressAlias}.unit`,
			`${addressAlias}.type`,
			`${addressAlias}.role`,
			`${addressAlias}.label`,
		]);
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
