import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for Agent entity.
 * Defines which fields can be projected and which relations can be included.
 * 
 * Note: Relations are handled by TypeORM's eager loading in the repository layer.
 * This config controls the top-level includes.
 */
export const AGENT_PROJECTION_CONFIG: ProjectionConfig = {
	// Always included (primary key + default sort field)
	required: ['id', 'agentId'],

	// Allowed fields for projection
	allowed: [
		'id',
		'agentId',
		'title',
		'firstName',
		'middleName',
		'lastName',
		'suffix',
		'preferredName',
		'birthDate',
		'lifecycleStatus',
		'systemId',
		'seedAgent',
		'joinDate',
		'anniversaryDate',
		'terminationDate',
		'isStaff',
		'agentCompanyId',
		'created',
		'lastModified',
		'modifiedBy',
		// Relations (singular names following GraphQL conventions)
		'agentCompany',
		'agentOffice',
		'office',
		'mls',
		'address',
		'agentAddress',
		'externalReference',
		'language',
		'contactMethod',
		'paymentSettings',
		'sponsorConfiguration',
		'activeLocation',
		'publicProfile',
		'license',
		'licensedStates',
		'agentTax',
		'tax',
		'note',
	],

	// Default fields (when no ?fields specified)
	// This is your "summary" view
	default: [
		'id',
		'agentId',
		'title',
		'firstName',
		'middleName',
		'lastName',
		'suffix',
		'preferredName',
		'birthDate',
		'lifecycleStatus',
		'systemId',
		'seedAgent',
		'joinDate',
		'anniversaryDate',
		'terminationDate',
		'isStaff',
		'created',
		'lastModified',
		'modifiedBy',
	],

	// Available relations that can be included via ?include=
	// Note: Uses singular names following GraphQL conventions
	relations: {
		agentOffice: {
			property: 'agentOffice',
			fields: ['id', 'officeId', 'isPrimary'],
			nested: ['office'], // Include the nested office entity for metadata access
		},
		office: {
			property: 'office',
			fields: ['id', 'name', 'phone', 'lifecycleStatus', 'primaryState', 'website'],
			// Direct access to OfficeEntity[] - hides junction table
		},
		mls: {
			property: 'mls',
			fields: ['id', 'name', 'shortName', 'lifecycleStatus', 'orgType', 'website'],
			// TypeORM handles junction table transparently via @ManyToMany
		},
		address: {
			property: 'addresses',
			fields: ['id', 'type', 'role', 'line1', 'line2', 'city', 'unit', 'postalCode', 'county', 'label', 'countryId', 'stateCode'],
			nested: ['country'], // Only country is a real relation
			// Note: state is loaded virtually via repository, not through TypeORM relations
		},
		agentAddress: {
			property: 'agentAddresses',
			fields: ['addressId', 'isPrimary'],
			nested: ['address'], // Use this when you need junction metadata like isPrimary
		},
		externalReference: {
			property: 'externalReferences',
			fields: ['id', 'externalReferenceId'],
			nested: ['externalReference'],
		},
		language: {
			property: 'languages',
			fields: ['id', 'languageId', 'proficiency'],
			nested: ['language'],
		},
		contactMethod: {
			property: 'contactMethods',
			fields: ['id', 'name', 'channel', 'subType', 'value', 'isPrimary', 'smsOptIn'],
		},
		paymentSettings: {
			property: 'paymentSettings',
			fields: ['id', 'capResetDate', 'splitCheck'],
		},
		sponsorConfiguration: {
			property: 'sponsorConfiguration',
			fields: ['id', 'sponsorBuffer'],
		},
		activeLocation: {
			property: 'activeLocations',
			fields: ['id', 'stateId', 'isPrimary'],
		},
		publicProfile: {
			property: 'publicProfile',
			fields: ['id', 'firstName', 'lastName', 'email', 'phone', 'bio'],
		},
		license: {
			property: 'licenses',
			fields: ['id', 'number', 'type', 'isPrimary', 'firstName', 'lastName', 'middleName', 'suffix', 'expirationDate', 'lineOfBusinessId', 'countryId', 'stateCode'],
			nested: ['country', 'lineOfBusiness'], // Related entities
		},
		// Virtual relations - loaded via AgentRepository.loadPrimaryContacts()
		// Uses leftJoinAndMapOne with filtered condition on contactMethods
		primaryEmail: {
			property: 'primaryEmail',
			fields: ['id', 'name', 'value', 'channel', 'subType', 'isPrimary'],
			virtual: true, // Loaded by repository, not ProjectionService
		},
		primaryPhone: {
			property: 'primaryPhone',
			fields: ['id', 'name', 'value', 'channel', 'subType', 'isPrimary'],
			virtual: true, // Loaded by repository, not ProjectionService
		},
		// Virtual relation - loaded via AgentRepository.loadPrimaryAddress()
		// Maps address directly (like primaryEmail), not the junction table
		primaryAddress: {
			property: 'primaryAddress',
			fields: ['id', 'type', 'role', 'line1', 'line2', 'city', 'unit', 'postalCode', 'county', 'label', 'countryId', 'stateCode'],
			nested: ['country', 'state'], // Both loaded by repository virtual join
			virtual: true, // Loaded by repository, not ProjectionService
		},
		// Virtual relation - loaded via AgentRepository.loadPrimaryLicense()
		// Returns the license with isPrimary = true
		primaryLicense: {
			property: 'primaryLicense',
			fields: ['id', 'number', 'type', 'isPrimary', 'firstName', 'lastName', 'middleName', 'suffix', 'expirationDate', 'lineOfBusinessId', 'countryId', 'stateCode'],
			nested: ['country', 'lineOfBusiness'],
			virtual: true, // Loaded by repository, not ProjectionService
		},
		// Virtual relation - loaded via AgentRepository (subquery)
		// Returns array of unique state codes where agent holds licenses
		// Lightweight alternative to include=license for grid displays
		licensedStates: {
			property: 'licensedStates',
			fields: [], // Returns string[] directly, not an object
			virtual: true, // Loaded by repository via subquery
		},
		// Junction table for agent-company associations
		// Includes isPrimary flag and nested agentCompany data
		agentCompanyAssociation: {
			property: 'agentCompanyAssociations',
			fields: ['id', 'agentId', 'agentCompanyId', 'isPrimary'],
			nested: ['agentCompany'], // Include the nested company entity
		},
		// Direct access to AgentCompany[] - hides junction table
		// Like office, this provides a cleaner API when junction metadata isn't needed
		agentCompany: {
			property: 'agentCompany',
			fields: ['id', 'legacyId', 'name', 'email', 'phone', 'taxId', 'useSsn'],
		},
		// Virtual relation - loaded via AgentRepository.loadPrimaryAgentCompany()
		// Returns the company with isPrimary = true from agent's company associations
		primaryAgentCompany: {
			property: 'primaryAgentCompany',
			fields: ['id', 'legacyId', 'name', 'email', 'phone', 'taxId'],
			virtual: true, // Loaded by repository, not ProjectionService
		},
		// Junction table for agent-tax associations
		// Includes isPrimary flag and nested tax data — use when junction metadata is needed
		agentTax: {
			property: 'agentTaxes',
			fields: ['id', 'agentId', 'taxId', 'isPrimary'],
			nested: ['tax'], // Include the nested tax entity
		},
		// Notes associated with the agent via agent_note junction table
		note: {
			property: 'notes',
			fields: ['id', 'actor', 'body', 'created', 'lastModified', 'modifiedBy'],
		},
		// Direct access to Tax[] - hides junction table
		// Like agentCompany/mls, this provides a cleaner API when junction metadata isn't needed
		tax: {
			property: 'tax',
			fields: ['id', 'taxIdType', 'valueLast4', 'valueToken'],
			// TypeORM handles junction table transparently via @ManyToMany
		},
		// Virtual relation - loaded via AgentRepository.loadPrimaryTax()
		// Returns the tax entity with isPrimary = true from agent's tax associations
		primaryTax: {
			property: 'primaryTax',
			fields: ['id', 'taxIdType', 'valueLast4', 'valueToken'],
			virtual: true, // Loaded by repository, not ProjectionService
		},
	},
};
