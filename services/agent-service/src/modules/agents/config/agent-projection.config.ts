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
		'agentCompanyId',
		'created',
		'lastModified',
		'modifiedBy',
	],

	// Available relations that can be included via ?include=
	// Note: Uses singular names following GraphQL conventions
	relations: {
		agentCompany: {
			property: 'agentCompany',
			fields: ['id', 'name', 'lifecycleStatus'],
		},
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
			fields: ['id', 'type', 'role', 'line1', 'line2', 'city', 'unit', 'postalCode', 'county', 'label', 'stateId'],
			nested: ['state'], // Include state entity for address.state projection
			// TypeORM handles junction table transparently via @ManyToMany (like mls)
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
			fields: ['id', 'type', 'role', 'line1', 'line2', 'city', 'unit', 'postalCode', 'county', 'label', 'stateId'],
			virtual: true, // Loaded by repository, not ProjectionService
		},
	},
};
