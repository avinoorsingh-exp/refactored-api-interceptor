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
		'joinDate', 'anniversaryDate', 'terminationDate', 'isStaff',
		// Relational filter fields (handled specially in findPage)
		'email', 'country',
	],
	allowedSortFields: [
		'id', 'agentId', 'title', 'firstName', 'middleName', 'lastName', 'suffix',
		'preferredName', 'birthDate', 'lifecycleStatus', 'systemId', 'seedAgent',
		'joinDate', 'anniversaryDate', 'terminationDate', 'isStaff',
		'created', 'lastModified',
		// Relational sort fields (handled specially in findPage)
		'primaryEmail',
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
const RELATIONAL_FILTER_FIELDS = ['email', 'country'] as const;

/**
 * Relational sort fields that require custom JOIN handling.
 * These are extracted from sort conditions and applied separately.
 */
const RELATIONAL_SORT_FIELDS = ['primaryEmail'] as const;

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
		standardConditions: Array<{ field: string; operator: string; value: any }>;
	} {
		const emailFilters: Array<{ field: string; operator: string; value: any }> = [];
		const countryFilters: Array<{ field: string; operator: string; value: any }> = [];
		const standardConditions: Array<{ field: string; operator: string; value: any }> = [];

		// Handle both array format (raw) and object format (normalized)
		const conditions = Array.isArray(filter) ? filter : filter?.conditions;

		if (!conditions) {
			return { emailFilters, countryFilters, standardConditions };
		}

		for (const condition of conditions) {
			if (condition.field === 'email') {
				emailFilters.push(condition);
			} else if (condition.field === 'country') {
				countryFilters.push(condition);
			} else {
				standardConditions.push(condition);
			}
		}

		return { emailFilters, countryFilters, standardConditions };
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
		standardConditions: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
	} {
		let primaryEmailSort: { field: string; direction: 'ASC' | 'DESC' } | null = null;
		const standardConditions: Array<{ field: string; direction: 'ASC' | 'DESC' }> = [];

		// Handle both array format (raw) and object format (normalized)
		const conditions = Array.isArray(sort) ? sort : sort?.conditions;

		if (!conditions) {
			return { primaryEmailSort, standardConditions };
		}

		for (const condition of conditions) {
			if (condition.field === 'primaryEmail') {
				primaryEmailSort = condition;
			} else {
				standardConditions.push(condition);
			}
		}

		return { primaryEmailSort, standardConditions };
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
 * Applies UUID search for agent ID.
 * Searches on the id field (UUID) with exact matching.
 * This works alongside existing individual field searches.
 * 
 * @param qb - Query builder
 * @param searchQuery - Optional search query string
 */
	private applyUuidSearch<T>(
		qb: SelectQueryBuilder<T>,
		searchQuery?: string,
	): void {
		if (!searchQuery || !searchQuery.trim()) {
			return;
		}

		// Check if search query looks like a UUID (basic validation)
		// UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		const trimmedQuery = searchQuery.trim();

		// Only search UUID if the query matches UUID format
		if (!uuidPattern.test(trimmedQuery)) {
			return;
		}

		const alias = this.getAlias();
		const paramName = 'uuidSearch';

		// Exact match for UUID (case-insensitive)
		qb.orWhere(
			`${alias}.id = :${paramName}::uuid`,
			{ [paramName]: trimmedQuery },
		);
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
		const filterObj =
			typeof query.filter === 'string' ? JSON.parse(query.filter) : query.filter;
		const sortObj = typeof query.sort === 'string' ? JSON.parse(query.sort) : query.sort;

		// Extract relational filters and sorts from parsed objects
		const { emailFilters, countryFilters, standardConditions } =
			this.extractRelationalFilters(filterObj);
		const { primaryEmailSort, standardConditions: standardSortConditions } =
			this.extractRelationalSorts(sortObj);

		// Check if we have any relational operations
		const hasRelationalFilters = emailFilters.length > 0 || countryFilters.length > 0;
		const hasRelationalSort = primaryEmailSort !== null;
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

				// Apply relational sort
				if (primaryEmailSort) {
					this.applyPrimaryEmailSort(
						qb,
						this.getAlias(),
						primaryEmailSort,
						!primaryEmailIncluded,
					);
				}
				// Apply full name search if search query is provided
				this.applyFullNameSearch(qb, modifiedQuery.search);

				// Apply email search if search query is provided
				this.applyEmailSearch(qb, modifiedQuery.search);

				//Apply UUID search if search query is provided
				this.applyUuidSearch(qb, modifiedQuery.search);
			}, { skipDefaultSort: hasRelationalSort });

			return addLicensedStates(result);
		}

		const result = await this.findWithQuery(modifiedQuery, selection, (qb) => {
			this.applyFullNameSearch(qb, modifiedQuery.search);
			this.applyEmailSearch(qb, modifiedQuery.search);
			this.applyUuidSearch(qb, modifiedQuery.search);
		});

		return addLicensedStates(result);
	}
}
