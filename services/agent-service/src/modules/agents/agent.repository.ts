import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { IAgentRepository } from './ports/agent.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentEntity, isUuid } from '@exprealty/database';
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
		'joinDate', 'anniversaryDate', 'terminationDate', 'isStaff',
		// Relational filter fields (handled specially in findPage)
		'email', 'country', 'licensedStates',
	],
	allowedSortFields: [
		'id', 'agentId', 'title', 'firstName', 'middleName', 'lastName', 'suffix',
		'preferredName', 'birthDate', 'lifecycleStatus', 'systemId', 'seedAgent',
		'joinDate', 'anniversaryDate', 'terminationDate', 'isStaff',
		'created', 'lastModified',
		// Relational sort fields (handled specially in findPage)
		'primaryEmail',
		'licensedStates', // full licensed state list string for sort (matches display)
	],
	allowedSearchFields: [
		'id', 'agentId', 'title', 'firstName', 'middleName', 'lastName', 'suffix',
		'preferredName', 'lifecycleStatus', 'systemId',
	],
	defaultSort: { field: 'agentId', direction: 'ASC' },
	projectionConfig: AGENT_PROJECTION_CONFIG,
	useStrategySearch: true, // Enable type-aware search for numeric fields
};

/**
 * Relational filter fields that require custom JOIN handling.
 * These are extracted from filter conditions and applied separately.
 */
const RELATIONAL_FILTER_FIELDS = ['email', 'country', 'licensedStates'] as const;

/**
 * Relational sort fields that require custom JOIN/subquery handling.
 * These are extracted from sort conditions and applied separately.
 */
const RELATIONAL_SORT_FIELDS = ['primaryEmail', 'licensedStates'] as const;

/**
 * TypeORM adapter implementing IAgentRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class AgentTypeOrmRepository
	extends BaseTypeOrmRepository<AgentEntity, Agent>
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
	 * Virtual relations (primaryEmail, primaryPhone, primaryAddress) are included
	 * as null when requested but not found, rather than being omitted.
	 *
	 * @param entity - The TypeORM entity to map
	 * @param selection - Optional field selection to inform virtual relation handling
	 */
	protected mapToDomain(entity: AgentEntity, selection?: FieldSelection): Agent {
		const result: Record<string, unknown> = {
			// Primary key
			id: entity.id,
			agentId: entity.agentId,

			// Required fields
			firstName: entity.firstName,
			lastName: entity.lastName,
			lifecycleStatus: entity.lifecycleStatus,

			// Optional string fields (always include, even if null/undefined)
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

		// Get the list of requested includes
		const requestedIncludes = selection?.include ?? [];

		// Map relations only if loaded (singular names following GraphQL conventions)
		if (entity.agentOffice) result.agentOffice = entity.agentOffice;
		if (entity.office) result.office = entity.office;
		if (entity.mls) result.mls = entity.mls;
		if (entity.addresses) result.address = entity.addresses;
		// Only include agentAddress junction if explicitly requested
		if (requestedIncludes.includes('agentAddress') && entity.agentAddresses) {
			result.agentAddress = entity.agentAddresses;
		}
		if (entity.externalReferences) result.externalReference = entity.externalReferences;
		if (entity.languages) result.language = entity.languages;
		if (entity.contactMethods) result.contactMethod = entity.contactMethods;
		if (entity.paymentSettings) result.paymentSettings = entity.paymentSettings;
		if (entity.sponsorConfiguration) result.sponsorConfiguration = entity.sponsorConfiguration;
		if (entity.activeLocations) result.activeLocation = entity.activeLocations;
		if (entity.publicProfile) result.publicProfile = entity.publicProfile;
		if (entity.licenses) result.license = entity.licenses;
		// Direct access to companies (hides junction table)
		if (entity.agentCompany) result.agentCompany = entity.agentCompany;
		// Notes associated with the agent via agent_note junction table
		if (entity.notes) result.note = entity.notes.map((n) => ({
			id: n.id,
			body: n.body,
			createdBy: n.createdBy,
			created: n.created,
			lastModified: n.lastModified,
			modifiedBy: n.modifiedBy,
		}));

		// Virtual relations - include as null if requested but not found
		// This ensures consistent API responses when include= is specified
		if (requestedIncludes.includes('primaryEmail')) {
			result.primaryEmail = entity.primaryEmail ?? null;
		} else if (entity.primaryEmail) {
			result.primaryEmail = entity.primaryEmail;
		}

		if (requestedIncludes.includes('primaryPhone')) {
			result.primaryPhone = entity.primaryPhone ?? null;
		} else if (entity.primaryPhone) {
			result.primaryPhone = entity.primaryPhone;
		}

		if (requestedIncludes.includes('primaryAddress')) {
			// Extract primary address from agentAddresses (loaded by loadPrimaryAddress)
			const primaryAgentAddress = entity.agentAddresses?.find(aa => aa.isPrimary);
			result.primaryAddress = primaryAgentAddress?.address ?? null;
		} else if (entity.primaryAddress) {
			result.primaryAddress = entity.primaryAddress;
		}

		if (requestedIncludes.includes('primaryLicense')) {
			result.primaryLicense = entity.primaryLicense ?? null;
		} else if (entity.primaryLicense) {
			result.primaryLicense = entity.primaryLicense;
		}

		// licensedStates is a simple string array, include as empty array if requested but none found
		if (requestedIncludes.includes('licensedStates')) {
			result.licensedStates = entity.licensedStates ?? [];
		} else if (entity.licensedStates) {
			result.licensedStates = entity.licensedStates;
		}

		// agentCompanyAssociation - junction table with nested company
		if (requestedIncludes.includes('agentCompanyAssociation') && entity.agentCompanyAssociations) {
			result.agentCompanyAssociation = entity.agentCompanyAssociations;
		}

		// agentTax - junction table with nested tax (available if explicitly requested)
		if (requestedIncludes.includes('agentTax') && entity.agentTaxes) {
			result.agentTax = entity.agentTaxes;
		}

		// primaryAgentCompany - virtual relation for primary company
		// The join maps the association to primaryAgentCompany, so we extract the nested company
		if (requestedIncludes.includes('primaryAgentCompany')) {
			// primaryAgentCompany is mapped as the association object with agentCompany nested
			const association = entity.primaryAgentCompany as any;
			result.primaryAgentCompany = association?.agentCompany ?? null;
		} else if (entity.primaryAgentCompany) {
			const association = entity.primaryAgentCompany as any;
			result.primaryAgentCompany = association?.agentCompany ?? null;
		}

		// primaryTax - virtual relation for primary tax identifier
		// The join maps the association to primaryTax, so we extract the nested tax
		if (requestedIncludes.includes('primaryTax')) {
			const association = entity.primaryTax as any;
			result.primaryTax = association?.tax ?? null;
		} else if (entity.primaryTax) {
			const association = entity.primaryTax as any;
			result.primaryTax = association?.tax ?? null;
		}

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
	 * Loads the primary address for an agent with nested state and country.
	 * Uses LEFT JOINs: junction table → address → state → country.
	 * Maps address directly to entity.primaryAddress (like loadPrimaryContacts).
	 *
	 * @param qb - Query builder
	 * @param alias - Base entity alias (usually 'agent')
	 */
	protected loadPrimaryAddress<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
	): void {
		const junctionAlias = 'primaryAddrJunction';
		const addressAlias = 'primaryAddrAddress';
		const countryAlias = 'primaryAddrCountry';
		const stateAlias = 'primaryAddrState';

		// Load agentAddresses where isPrimary = true, with nested address->country->state
		// The primary address will be extracted in mapToDomain
		qb.leftJoinAndSelect(
			`${alias}.agentAddresses`,
			junctionAlias,
			`${junctionAlias}.isPrimary = true`,
		);

		// Join and select the address from the junction
		qb.leftJoinAndSelect(`${junctionAlias}.address`, addressAlias);

		// Join and select country from address (now a direct relationship)
		qb.leftJoinAndSelect(`${addressAlias}.country`, countryAlias);

		// Virtual join for state using composite key (countryId + stateCode)
		// This populates the address.state property virtually
		qb.leftJoinAndMapOne(
			`${addressAlias}.state`,
			'StateEntity',
			stateAlias,
			`${stateAlias}.countryId = ${addressAlias}.countryId AND ${stateAlias}.code = ${addressAlias}.stateCode`,
		);
	}

	/**
	 * Loads the primary license for an agent with nested country and line of business.
	 * Uses leftJoinAndMapOne to map directly to entity.primaryLicense.
	 *
	 * @param qb - Query builder
	 * @param alias - Base entity alias (usually 'agent')
	 */
	protected loadPrimaryLicense<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
	): void {
		const licenseAlias = 'primaryLicense';
		const countryAlias = 'primaryLicenseCountry';
		const lobAlias = 'primaryLicenseLob';

		// Join licenses where isPrimary = true
		qb.leftJoinAndMapOne(
			`${alias}.primaryLicense`,
			`${alias}.licenses`,
			licenseAlias,
			`${licenseAlias}.isPrimary = true`,
		);

		// Join and select country from license
		qb.leftJoinAndSelect(`${licenseAlias}.country`, countryAlias);

		// Join and select line of business from license
		qb.leftJoinAndSelect(`${licenseAlias}.lineOfBusiness`, lobAlias);
	}

	/**
	 * Loads the primary agent company for an agent.
	 * Uses leftJoinAndMapOne through the junction table where isPrimary = true.
	 * The company is mapped directly to entity.primaryAgentCompany.
	 *
	 * @param qb - Query builder
	 * @param alias - Base entity alias (usually 'agent')
	 */
	protected loadPrimaryAgentCompany<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
	): void {
		const associationAlias = 'primaryAgentCompanyAssoc';
		const companyAlias = 'primaryAgentCompany';

		// First join the junction table where isPrimary = true
		// Then map the company entity directly to the virtual property
		qb.leftJoinAndMapOne(
			`${alias}.primaryAgentCompany`,
			`${alias}.agentCompanyAssociations`,
			associationAlias,
			`${associationAlias}.isPrimary = true`,
		);

		// Join the company through the association
		qb.leftJoinAndSelect(`${associationAlias}.agentCompany`, companyAlias);
	}

	/**
	 * Loads the primary tax identifier for an agent.
	 * Uses leftJoinAndMapOne through the junction table where isPrimary = true.
	 * The tax entity is mapped directly to entity.primaryTax.
	 *
	 * @param qb - Query builder
	 * @param alias - Base entity alias (usually 'agent')
	 */
	protected loadPrimaryTax<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
	): void {
		const associationAlias = 'primaryTaxAssoc';
		const taxAlias = 'primaryTax';

		// First join the junction table where isPrimary = true
		// Then map the tax entity directly to the virtual property
		qb.leftJoinAndMapOne(
			`${alias}.primaryTax`,
			`${alias}.agentTaxes`,
			associationAlias,
			`${associationAlias}.isPrimary = true`,
		);

		// Join the tax through the association
		qb.leftJoinAndSelect(`${associationAlias}.tax`, taxAlias);
	}

	/**
	 * Loads licensed states for agents.
	 * Uses a correlated subquery with array_agg for efficiency.
	 * Results are loaded separately and merged with entities.
	 *
	 * @param agentIds - Array of agent IDs to load licensed states for
	 * @returns Map of agent ID to array of state codes
	 */
	protected async loadLicensedStates(agentIds: string[]): Promise<Map<string, string[]>> {
		if (agentIds.length === 0) {
			return new Map();
		}

		// Use a raw query with array_agg for efficient grouping
		// This gets all unique state codes per agent in a single query
		const results = await this.repo.manager.query<{ agent_id: string; state_codes: string[] }[]>(
			`SELECT 
				l.agent_id,
				array_agg(DISTINCT l.state_code) FILTER (WHERE l.state_code IS NOT NULL) as state_codes
			FROM core.license l
			WHERE l.agent_id = ANY($1)
			GROUP BY l.agent_id`,
			[agentIds],
		);

		const stateMap = new Map<string, string[]>();
		for (const row of results) {
			stateMap.set(row.agent_id, row.state_codes ?? []);
		}

		return stateMap;
	}

	/**
	 * Load addresses with virtual state relations.
	 * Used when include=address is specified.
	 * Adds virtual state mapping to addresses already joined by ProjectionService.
	 *
	 * @param qb - Query builder
	 * @param alias - Base entity alias (usually 'agent')
	 */
	protected loadAddressesWithVirtualState<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
	): void {
		// Use the same alias pattern as ProjectionService
		const addressAlias = `${alias}_address`;
		const stateAlias = `${addressAlias}_state`;

		// The ProjectionService has already joined:
		// - agent.addresses as agent_address
		// - agent_address.country as agent_address_country
		// We only need to add the virtual state mapping

		// Check if addresses relation is already joined by projection service
		const existingJoins = qb.expressionMap.joinAttributes;
		const addressJoined = existingJoins.some(j => j.alias.name === addressAlias);

		if (!addressJoined) {
			// This shouldn't happen when include=address is used, but handle it just in case
			this.logger.warn('Address not joined by ProjectionService, skipping virtual state mapping');
			return;
		}

		// Only add the virtual state join - country is already joined by ProjectionService
		// Virtual join for state using composite key (countryId + stateCode)
		qb.leftJoinAndMapOne(
			`${addressAlias}.state`,
			'StateEntity',
			stateAlias,
			`${stateAlias}.countryId = ${addressAlias}.countryId AND ${stateAlias}.code = ${addressAlias}.stateCode`,
		);
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
			if (item.startsWith('primary') && item !== 'primaryAddress' && item !== 'primaryLicense') {
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
	 * Check if primaryLicense is requested in includes.
	 */
	private hasPrimaryLicenseInclude(include?: string[]): boolean {
		return include?.includes('primaryLicense') ?? false;
	}

	/**
	 * Check if licensedStates is requested in includes.
	 */
	private hasLicensedStatesInclude(include?: string[]): boolean {
		return include?.includes('licensedStates') ?? false;
	}

	/**
	 * Check if primaryAgentCompany is requested in includes.
	 */
	private hasPrimaryAgentCompanyInclude(include?: string[]): boolean {
		return include?.includes('primaryAgentCompany') ?? false;
	}

	/**
	 * Check if primaryTax is requested in includes.
	 */
	private hasPrimaryTaxInclude(include?: string[]): boolean {
		return include?.includes('primaryTax') ?? false;
	}

	/**
	 * Extract relational filter conditions from the query filter.
	 * Returns the extracted conditions and the remaining standard conditions.
	 *
	 * Handles both formats:
	 * - Raw array format from query string: [{field, operator, value}, ...]
	 * - Normalized format after Zod parsing: {conditions: [{field, operator, value}, ...], logicalOperator}
	 */
	private extractRelationalFilters(filter?:
		| Array<{ field: string; operator: string; value: any }>
		| { conditions?: Array<{ field: string; operator: string; value: any }>; logicalOperator?: string }
	): {
		emailFilters: Array<{ field: string; operator: string; value: any }>;
		countryFilters: Array<{ field: string; operator: string; value: any }>;
		licensedStatesFilters: Array<{ field: string; operator: string; value: any }>;
		standardConditions: Array<{ field: string; operator: string; value: any }>;
	} {
		const emailFilters: Array<{ field: string; operator: string; value: any }> = [];
		const countryFilters: Array<{ field: string; operator: string; value: any }> = [];
		const licensedStatesFilters: Array<{ field: string; operator: string; value: any }> = [];
		const standardConditions: Array<{ field: string; operator: string; value: any }> = [];

		// Handle both array format (raw) and object format (normalized)
		const conditions = Array.isArray(filter) ? filter : filter?.conditions;

		if (!conditions) {
			return { emailFilters, countryFilters, licensedStatesFilters, standardConditions };
		}

		for (const condition of conditions) {
			if (condition.field === 'email') {
				emailFilters.push(condition);
			} else if (condition.field === 'country') {
				countryFilters.push(condition);
			} else if (condition.field === 'licensedStates') {
				licensedStatesFilters.push(condition);
			} else {
				standardConditions.push(condition);
			}
		}

		return { emailFilters, countryFilters, licensedStatesFilters, standardConditions };
	}

	/**
	 * Extract relational sort conditions from the query sort.
	 * Returns the extracted conditions and the remaining standard conditions.
	 *
	 * Handles both formats:
	 * - Raw array format from query string: [{field, direction}, ...]
	 * - Normalized format after Zod parsing: {conditions: [{field, direction}, ...]}
	 */
	private extractRelationalSorts(sort?:
		| Array<{ field: string; direction: 'ASC' | 'DESC' }>
		| { conditions?: Array<{ field: string; direction: 'ASC' | 'DESC' }> }
	): {
		primaryEmailSort: { field: string; direction: 'ASC' | 'DESC' } | null;
		licensedStatesSort: { field: string; direction: 'ASC' | 'DESC' } | null;
		standardConditions: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
	} {
		let primaryEmailSort: { field: string; direction: 'ASC' | 'DESC' } | null = null;
		let licensedStatesSort: { field: string; direction: 'ASC' | 'DESC' } | null = null;
		const standardConditions: Array<{ field: string; direction: 'ASC' | 'DESC' }> = [];

		// Handle both array format (raw) and object format (normalized)
		const conditions = Array.isArray(sort) ? sort : sort?.conditions;

		if (!conditions) {
			return { primaryEmailSort, licensedStatesSort, standardConditions };
		}

		for (const condition of conditions) {
			if (condition.field === 'primaryEmail') {
				primaryEmailSort = condition;
			} else if (condition.field === 'licensedStates') {
				licensedStatesSort = condition;
			} else {
				standardConditions.push(condition);
			}
		}

		return { primaryEmailSort, licensedStatesSort, standardConditions };
	}

	/**
	 * Apply email filter conditions to the query builder.
	 * Joins contactMethods and filters where channel='email'.
	 */
	private applyEmailFilters<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
		filters: Array<{ field: string; operator: string; value: any }>,
	): void {
		if (filters.length === 0) return;

		const emailAlias = 'emailFilter';

		// Join contactMethods for email filtering
		qb.leftJoin(
			`${alias}.contactMethods`,
			emailAlias,
			`${emailAlias}.channel = :emailFilterChannel`,
			{ emailFilterChannel: 'email' },
		);

		// Apply each email filter condition
		filters.forEach((condition, index) => {
			const paramName = `emailFilter_${index}`;
			this.applyRelationalFilterCondition(qb, `${emailAlias}.value`, condition, paramName);
		});
	}

	/**
	 * Apply country filter conditions to the query builder.
	 * Joins agentAddresses → address → country (state is now optional via countryId + stateCode).
	 */
	private applyCountryFilters<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
		filters: Array<{ field: string; operator: string; value: any }>,
	): void {
		if (filters.length === 0) return;

		const junctionAlias = 'countryFilterJunction';
		const addressAlias = 'countryFilterAddress';
		const countryAlias = 'countryFilter';

		// Join through the relation chain
		qb.leftJoin(`${alias}.agentAddresses`, junctionAlias);
		qb.leftJoin(`${junctionAlias}.address`, addressAlias);
		qb.leftJoin(`${addressAlias}.country`, countryAlias);

		// Apply each country filter condition (search by name or alpha2)
		filters.forEach((condition, index) => {
			const paramName = `countryFilter_${index}`;
			// Support filtering by country name or alpha2 code
			if (condition.operator === 'eq') {
				// Exact match: check both name and alpha2
				qb.andWhere(
					`(${countryAlias}.name = :${paramName} OR ${countryAlias}.alpha2 = :${paramName})`,
					{ [paramName]: condition.value },
				);
			} else if (condition.operator === 'ilike' || condition.operator === 'contains') {
				qb.andWhere(`${countryAlias}.name ILIKE :${paramName}`, {
					[paramName]: `%${condition.value}%`,
				});
			} else {
				// Default to name field for other operators
				this.applyRelationalFilterCondition(qb, `${countryAlias}.name`, condition, paramName);
			}
		});
	}

	/**
	 * Apply licensedStates filter conditions to the query builder.
	 * Uses EXISTS subquery on core.license so agents are not duplicated.
	 * Supports eq (exact state code), in (any of the state codes), startsWith (e.g. "T" matches TX, TN).
	 * State codes in DB are 2-letter (e.g. TX, FL, AZ); "T" with eq matches nothing.
	 */
	private applyLicensedStatesFilters<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
		filters: Array<{ field: string; operator: string; value: any }>,
	): void {
		if (filters.length === 0) return;

		filters.forEach((condition, index) => {
			const paramName = `licensedStatesFilter_${index}`;
			// Quote alias for PostgreSQL so correlated subquery resolves (e.g. "agent".id)
			const aliasRef = `"${alias}".id`;
			const subquery = `EXISTS (SELECT 1 FROM core.license l WHERE l.agent_id = ${aliasRef} AND l.state_code IS NOT NULL`;

			if (condition.operator === 'in') {
				const values = Array.isArray(condition.value) ? condition.value : [condition.value];
				if (values.length === 0) return;
				qb.andWhere(`${subquery} AND l.state_code IN (:...${paramName}))`, {
					[paramName]: values,
				});
			} else if (condition.operator === 'startsWith') {
				// e.g. "a" matches AZ, AL (case-insensitive via ILIKE)
				const raw = condition.value != null ? String(condition.value).trim() : '';
				if (raw === '') return;
				const pattern = `${raw.replace(/%/g, '\\%')}%`;
				qb.andWhere(`${subquery} AND l.state_code ILIKE :${paramName})`, {
					[paramName]: pattern,
				});
			} else if (condition.operator === 'eq') {
				qb.andWhere(`${subquery} AND l.state_code = :${paramName})`, {
					[paramName]: condition.value,
				});
			} else {
				qb.andWhere(`${subquery} AND l.state_code = :${paramName})`, {
					[paramName]: condition.value,
				});
			}
		});
	}

	/**
	 * Apply a single relational filter condition.
	 */
	private applyRelationalFilterCondition<T>(
		qb: SelectQueryBuilder<T>,
		fieldPath: string,
		condition: { field: string; operator: string; value: any },
		paramName: string,
	): void {
		const { operator, value } = condition;

		switch (operator) {
			case 'eq':
				qb.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: value });
				break;
			case 'ne':
				qb.andWhere(`${fieldPath} != :${paramName}`, { [paramName]: value });
				break;
			case 'ilike':
			case 'contains':
				qb.andWhere(`${fieldPath} ILIKE :${paramName}`, { [paramName]: `%${value}%` });
				break;
			case 'startsWith':
				qb.andWhere(`${fieldPath} ILIKE :${paramName}`, { [paramName]: `${value}%` });
				break;
			case 'endsWith':
				qb.andWhere(`${fieldPath} ILIKE :${paramName}`, { [paramName]: `%${value}` });
				break;
			case 'in':
				qb.andWhere(`${fieldPath} IN (:...${paramName})`, { [paramName]: value });
				break;
			case 'isNull':
				qb.andWhere(`${fieldPath} IS NULL`);
				break;
			case 'isNotNull':
				qb.andWhere(`${fieldPath} IS NOT NULL`);
				break;
			default:
				qb.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: value });
		}
	}

	/**
	 * Apply primaryEmail sort to the query builder.
	 * Ensures primaryEmail is joined and sorts by the value field.
	 */
	private applyPrimaryEmailSort<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
		sortCondition: { field: string; direction: 'ASC' | 'DESC' },
		needsJoin: boolean,
	): void {
		const primaryEmailAlias = 'primaryEmail';

		// Only add join if not already joined via include
		if (needsJoin) {
			qb.leftJoin(
				`${alias}.contactMethods`,
				primaryEmailAlias,
				`${primaryEmailAlias}.channel = :primaryEmailSortChannel AND ${primaryEmailAlias}.isPrimary = true`,
				{ primaryEmailSortChannel: 'email' },
			);
			// Select the value field for sorting
			qb.addSelect(`${primaryEmailAlias}.value`);
		}

		// Apply the sort - use orderBy since this is the primary requested sort
		qb.orderBy(`${primaryEmailAlias}.value`, sortCondition.direction, 'NULLS LAST');
	}

	/**
	 * Apply licensedStates sort to the query builder.
	 * Orders by the full licensed state list string (e.g. "AZ, CA, FL, NY, TX")
	 * so sort order matches what the user sees in the LICENSED STATE column.
	 */
	private applyLicensedStatesSort<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
		sortCondition: { field: string; direction: 'ASC' | 'DESC' },
	): void {
		const sortAlias = 'licensed_states_sort';
		const subquery = `(
			SELECT string_agg(s.state_code, ', ' ORDER BY s.state_code)
			FROM (
				SELECT DISTINCT l.state_code
				FROM core.license l
				WHERE l.agent_id = ${alias}.id AND l.state_code IS NOT NULL
			) s
		)`;
		qb.addSelect(subquery, sortAlias);
		qb.orderBy(sortAlias, sortCondition.direction, 'NULLS LAST');
	}

	/**
	 * Applies full name search using SQL CONCAT.
	 * This works alongside existing individual field searches (firstName, lastName).
	 * 
	 * @param qb - Query builder
	 * @param searchQuery - Optional search query string
	 */
	private applyFullNameSearch<T>(
		qb: SelectQueryBuilder<T>,
		searchQuery?: string,
	): void {
		if (!searchQuery || !searchQuery.trim()) {
			return;
		}

		const alias = this.getAlias();
		const paramName = 'fullNameSearch';

		// Use CONCAT to concatenate firstName and lastName with a space
		// TypeORM will resolve property names to column names (firstName -> first_name, lastName -> last_name)
		// Use COALESCE to handle null values gracefully
		qb.orWhere(
			`CONCAT(COALESCE(${alias}.firstName, ''), ' ', COALESCE(${alias}.lastName, '')) ILIKE :${paramName}`,
			{ [paramName]: `%${searchQuery.trim()}%` },
		);
	}
	/**
 * Applies email search using LEFT JOIN on contactMethods.
 * Searches on contactMethods.value where channel='email' to match email addresses.
 * This works alongside existing individual field searches and full name search.
 * 
 * @param qb - Query builder
 * @param searchQuery - Optional search query string
 */
	private applyEmailSearch<T>(
		qb: SelectQueryBuilder<T>,
		searchQuery?: string,
	): void {
		if (!searchQuery || !searchQuery.trim()) {
			return;
		}

		const alias = this.getAlias();
		const emailSearchAlias = 'emailSearch';
		const paramName = 'emailSearchValue';

		// LEFT JOIN contactMethods where channel='email' for email search
		// This allows searching email addresses even if agent has no email (LEFT JOIN)
		qb.leftJoin(
			`${alias}.contactMethods`,
			emailSearchAlias,
			`${emailSearchAlias}.channel = :emailSearchChannel`,
			{ emailSearchChannel: 'email' },
		);

		// Search on the value field (email address) with case-insensitive partial matching
		qb.orWhere(
			`${emailSearchAlias}.value ILIKE :${paramName}`,
			{ [paramName]: `%${searchQuery.trim()}%` },
		);
	}
	/**
 * Applies UUID search exclusively for agent ID.
 * When a UUID is detected in the search query, this method ensures
 * only exact UUID matches are returned by using andWhere (exclusive search).
 * This prevents text field searches from interfering with UUID lookups.
 * 
 * @param qb - Query builder
 * @param searchQuery - UUID search query string
 */
	private applyUuidSearchExclusive<T>(
		qb: SelectQueryBuilder<T>,
		searchQuery?: string,
	): void {
		if (!searchQuery || !searchQuery.trim()) {
			return;
		}

		// Defensive check: Validate UUID even though it's checked in findPage
		// This ensures method safety if called directly or if query.search changes
		if (!isUuid(searchQuery)) {
			return;
		}

		const alias = this.getAlias();
		const paramName = 'uuidSearch';
		const trimmedQuery = searchQuery.trim();

		// Exact match for UUID using andWhere (exclusive search)
		// Use CAST instead of ::uuid for better TypeORM parameter binding
		qb.andWhere(
			`${alias}.id = CAST(:${paramName} AS uuid)`,
			{ [paramName]: trimmedQuery },
		);
	}
	/**
	 * Detects malformed UUIDs (strings that start with UUID pattern but have extra characters).
	 * These should be rejected to prevent unintended matches from numeric/text searches.
	 * 
	 * @param searchQuery - Search query to check
	 * @returns true if search query is a malformed UUID
	 */
	private isMalformedUuid(searchQuery: string | undefined | null): boolean {
		if (!searchQuery) return false;
		if (typeof searchQuery !== 'string') return false;
		
		const trimmed = searchQuery.trim();
		
		// Check if it starts with a UUID pattern (8-4-4-4-12 format)
		// UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
		const uuidPrefixPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
		
		// If it matches UUID prefix but the full string doesn't match UUID pattern, it's malformed
		if (uuidPrefixPattern.test(trimmed)) {
			// Check if it's NOT a valid UUID (has extra characters)
			return !isUuid(trimmed);
		}
		
		return false;
	}

	/**
	 * Finds agents with pagination, filtering, sorting, and search.
	 * Handles primary contact and address loading via custom joins.
	 * Supports relational filtering (email, country) and sorting (primaryEmail).
	 * Supports licensedStates virtual field via post-query loading.
	 */
	async findPage(
		query: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<Agent>> {
		const primaryContactTypes = this.extractPrimaryContactTypes(selection?.include);
		const hasPrimaryAddress = this.hasPrimaryAddressInclude(selection?.include);
		const hasPrimaryLicense = this.hasPrimaryLicenseInclude(selection?.include);
		const hasLicensedStates = this.hasLicensedStatesInclude(selection?.include);
		const hasPrimaryAgentCompany = this.hasPrimaryAgentCompanyInclude(selection?.include);
		const hasPrimaryTax = this.hasPrimaryTaxInclude(selection?.include);
		const hasAddresses = selection?.include?.includes('address') || false;

		// Parse filter if it's a JSON string (query params come in as strings)
		let filterObj: { conditions?: Array<{ field: string; operator: string; value: any }> } | undefined;
		try {
			const raw =
				typeof query.filter === 'string' ? JSON.parse(query.filter) : query.filter;
			filterObj =
				raw === undefined || raw === null
					? { conditions: [] }
					: Array.isArray(raw)
						? { conditions: raw }
						: typeof raw === 'object' && raw !== null && 'conditions' in raw
							? raw
							: { conditions: [] };
		} catch {
			filterObj = { conditions: [] };
		}
		const sortObj = typeof query.sort === 'string' ? JSON.parse(query.sort) : query.sort;

		// Extract relational filters and sorts from parsed objects
		const { emailFilters, countryFilters, licensedStatesFilters, standardConditions } =
			this.extractRelationalFilters(filterObj);
		const { primaryEmailSort, licensedStatesSort, standardConditions: standardSortConditions } =
			this.extractRelationalSorts(sortObj);

		// Check if we have any relational operations
		const hasRelationalFilters =
			emailFilters.length > 0 || countryFilters.length > 0 || licensedStatesFilters.length > 0;
		const hasRelationalSort = primaryEmailSort !== null || licensedStatesSort !== null;
		const needsCustomQuery =
			primaryContactTypes.length > 0 ||
			hasPrimaryAddress ||
			hasPrimaryLicense ||
			hasPrimaryAgentCompany ||
			hasPrimaryTax ||
			hasAddresses ||
			hasRelationalFilters ||
			hasRelationalSort;

		// Build modified query params without relational fields
		const modifiedQuery: Partial<QueryParams> = { ...query };
		// Check if search is a UUID - if so, make it exclusive
		const isUuidSearch = isUuid(query.search);
		const isMalformedUuid = this.isMalformedUuid(query.search);

		// If UUID search, remove search from query to skip base strategy search
		// This ensures UUID search is exclusive and doesn't trigger text searches on firstName, lastName, etc.
		if (isUuidSearch) {
			modifiedQuery.search = undefined;
		} else if (isMalformedUuid) {
			// Reject malformed UUIDs - return empty results for security
			// This prevents numeric search from extracting partial numbers (e.g., "76" from "76c8add5-...-extra")
			modifiedQuery.search = undefined;
		}
		if (hasRelationalFilters && filterObj) {
			// Rebuild filter as JSON string in raw array format (downstream code parses it again)
			modifiedQuery.filter = JSON.stringify(standardConditions) as any;
		}
		if (hasRelationalSort && sortObj) {
			// Rebuild sort as JSON string in raw array format (downstream code parses it again)
			modifiedQuery.sort = JSON.stringify(standardSortConditions) as any;
		}

		// Helper to post-process results with licensedStates if requested
		const addLicensedStates = async (result: PageResult<Agent>): Promise<PageResult<Agent>> => {
			if (!hasLicensedStates || result.items.length === 0) {
				return result;
			}
			
			const agentIds = result.items.map(a => a.id);
			const statesMap = await this.loadLicensedStates(agentIds);
			
			// Add licensedStates to each agent
			const itemsWithStates = result.items.map(agent => ({
				...agent,
				licensedStates: statesMap.get(agent.id) ?? [],
			}));
			
			return { ...result, items: itemsWithStates };
		};

		if (needsCustomQuery) {
			// Check if primaryEmail is already being included (so we don't double-join)
			const primaryEmailIncluded = primaryContactTypes.includes('email');

			const result = await this.findWithQuery(modifiedQuery, selection, (qb) => {
				// Add virtual relation joins for includes
				if (primaryContactTypes.length > 0) {
					this.loadPrimaryContacts(qb, this.getAlias(), primaryContactTypes);
				}
				if (hasPrimaryAddress) {
					this.loadPrimaryAddress(qb, this.getAlias());
				}
				if (hasPrimaryLicense) {
					this.loadPrimaryLicense(qb, this.getAlias());
				}
				if (hasPrimaryAgentCompany) {
					this.loadPrimaryAgentCompany(qb, this.getAlias());
				}
				if (hasPrimaryTax) {
					this.loadPrimaryTax(qb, this.getAlias());
				}
				if (hasAddresses) {
					this.loadAddressesWithVirtualState(qb, this.getAlias());
				}

				// Apply relational filters
				if (emailFilters.length > 0) {
					this.applyEmailFilters(qb, this.getAlias(), emailFilters);
				}
				if (countryFilters.length > 0) {
					this.applyCountryFilters(qb, this.getAlias(), countryFilters);
				}
				if (licensedStatesFilters.length > 0) {
					this.applyLicensedStatesFilters(qb, this.getAlias(), licensedStatesFilters);
				}

				// Apply relational sorts
				if (primaryEmailSort) {
					this.applyPrimaryEmailSort(
						qb,
						this.getAlias(),
						primaryEmailSort,
						!primaryEmailIncluded,
					);
				}
				if (licensedStatesSort) {
					this.applyLicensedStatesSort(
						qb,
						this.getAlias(),
						licensedStatesSort,
					);
				}
				// Apply search: UUID search is exclusive
				if (isUuidSearch) {
					// UUID search only - use exclusive method with andWhere
					this.applyUuidSearchExclusive(qb, query.search);
				} else if (isMalformedUuid) {
					// Reject malformed UUIDs - explicitly return no results
					// This prevents unintended matches from numeric/text searches
					qb.andWhere('1=0'); // Always false condition = no results
				} else {
					// Apply all search methods for normal text search
					this.applyFullNameSearch(qb, modifiedQuery.search);
					this.applyEmailSearch(qb, modifiedQuery.search);
				}
			}, { skipDefaultSort: hasRelationalSort });

			return addLicensedStates(result);
		}

		const result = await this.findWithQuery(modifiedQuery, selection, (qb) => {
			// Apply search: UUID search is exclusive
			if (isUuidSearch) {
				// UUID search only - use exclusive method with andWhere
				this.applyUuidSearchExclusive(qb, query.search);
			} else if (isMalformedUuid) {
				// Reject malformed UUIDs - explicitly return no results
				// This prevents unintended matches from numeric/text searches
				qb.andWhere('1=0'); // Always false condition = no results
			} else {
				// Apply all search methods for normal text search
				this.applyFullNameSearch(qb, modifiedQuery.search);
				this.applyEmailSearch(qb, modifiedQuery.search);
			}
		});

		return addLicensedStates(result);
	}
}
