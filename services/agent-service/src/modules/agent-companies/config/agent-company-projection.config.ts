import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for AgentCompany entity
 */
export const AGENT_COMPANY_PROJECTION_CONFIG: ProjectionConfig = {
	// Always included (primary key + default sort field)
	required: ['id', 'name'],

	// Allowed fields for projection
	allowed: [
		'id',
		'legacyId',
		'name',
		'email',
		'phone',
		'taxId',
		'useSsn',
		'created',
		'lastModified',
		'modifiedBy',
	],

	// Default fields (when no ?fields specified)
	default: [
		'id',
		'legacyId',
		'name',
		'email',
		'phone',
		'useSsn',
		'created',
		'lastModified',
	],

	// Available relations
	relations: {
		agentAssociations: {
			property: 'agentAssociations',
			fields: ['id', 'agentId', 'isPrimary'],
		},
	},
};

/**
 * Pre-defined field presets for common use cases
 */
export const AGENT_COMPANY_FIELD_PRESETS = {
	minimal: ['id', 'name'],
	summary: AGENT_COMPANY_PROJECTION_CONFIG.default,
	detail: [...AGENT_COMPANY_PROJECTION_CONFIG.default, 'taxId'],
};
