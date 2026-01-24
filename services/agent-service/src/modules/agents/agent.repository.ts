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
		// Relational filter fields (handled specially in findPage)
		'email', 'country',
	],
	allowedSortFields: [
		'id', 'agentId', 'title', 'firstName', 'middleName', 'lastName', 'suffix',
		'preferredName', 'birthDate', 'lifecycleStatus', 'systemId', 'seedAgent',
		'joinDate', 'anniversaryDate', 'terminationDate', 'isStaff', 'agentCompanyId',
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

		// Get the list of requested includes
		const requestedIncludes = selection?.include ?? [];

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
		const stateAlias = 'primaryAddrState';
		const countryAlias = 'primaryAddrCountry';

		// Load agentAddresses where isPrimary = true, with nested address->state->country
		// The primary address will be extracted in mapToDomain
		qb.leftJoinAndSelect(
			`${alias}.agentAddresses`,
			junctionAlias,
			`${junctionAlias}.isPrimary = true`,
		);

		// Join and select the address from the junction
		qb.leftJoinAndSelect(`${junctionAlias}.address`, addressAlias);

		// Join and select state from address
		qb.leftJoinAndSelect(`${addressAlias}.state`, stateAlias);

		// Join and select country from state
		qb.leftJoinAndSelect(`${stateAlias}.country`, countryAlias);
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
	 * Joins agentAddresses → address → state → country.
	 */
	private applyCountryFilters<T>(
		qb: SelectQueryBuilder<T>,
		alias: string,
		filters: Array<{ field: string; operator: string; value: any }>,
	): void {
		if (filters.length === 0) return;

		const junctionAlias = 'countryFilterJunction';
		const addressAlias = 'countryFilterAddress';
		const stateAlias = 'countryFilterState';
		const countryAlias = 'countryFilter';

		// Join through the relation chain
		qb.leftJoin(`${alias}.agentAddresses`, junctionAlias);
		qb.leftJoin(`${junctionAlias}.address`, addressAlias);
		qb.leftJoin(`${addressAlias}.state`, stateAlias);
		qb.leftJoin(`${stateAlias}.country`, countryAlias);

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
	 * Finds agents with pagination, filtering, sorting, and search.
	 * Handles primary contact and address loading via custom joins.
	 * Supports relational filtering (email, country) and sorting (primaryEmail).
	 */
	async findPage(
		query: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<Agent>> {
		const primaryContactTypes = this.extractPrimaryContactTypes(selection?.include);
		const hasPrimaryAddress = this.hasPrimaryAddressInclude(selection?.include);

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

		if (needsCustomQuery) {
			// Check if primaryEmail is already being included (so we don't double-join)
			const primaryEmailIncluded = primaryContactTypes.includes('email');

			return this.findWithQuery(modifiedQuery, selection, (qb) => {
				// Add virtual relation joins for includes
				if (primaryContactTypes.length > 0) {
					this.loadPrimaryContacts(qb, this.getAlias(), primaryContactTypes);
				}
				if (hasPrimaryAddress) {
					this.loadPrimaryAddress(qb, this.getAlias());
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
			}, { skipDefaultSort: hasRelationalSort });
		}

		return this.findWithQuery(modifiedQuery, selection,(qb) => {
			this.applyFullNameSearch(qb, modifiedQuery.search);
			this.applyEmailSearch(qb, modifiedQuery.search);
		});
	}
}
