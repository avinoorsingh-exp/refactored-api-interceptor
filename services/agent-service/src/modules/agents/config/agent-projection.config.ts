import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for Agent entity.
 * Defines which fields can be projected and which relations can be included.
 * 
 * Note: Relations are handled by TypeORM's eager loading in the repository layer.
 * This config controls the top-level includes.
 */
export const AGENT_PROJECTION_CONFIG: ProjectionConfig = {
	// Always included (primary key)
	required: ['id'],

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
		'lifecycleStatus',
		'joinDate',
		'isStaff',
		'agentCompanyId',
		'created',
		'lastModified',
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
		agentAddress: {
			property: 'agentAddresses',
			fields: ['id', 'addressId', 'isPrimary', 'addressType'],
			nested: ['address'], // Include the nested address entity
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
	},
};
