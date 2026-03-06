import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for AgentCompanyAssociation entity
 */
export const AGENT_COMPANY_ASSOCIATION_PROJECTION_CONFIG: ProjectionConfig = {
	// Always included (primary key + essential fields)
	required: ['id', 'agentId', 'agentCompanyId'],

	// Allowed fields for projection
	allowed: [
		'id',
		'agentId',
		'agentCompanyId',
		'isPrimary',
	],

	// Default fields (when no ?fields specified)
	default: [
		'id',
		'agentId',
		'agentCompanyId',
		'isPrimary',
	],

	// Available relations (singular names following GraphQL conventions)
	relations: {
		agent: {
			property: 'agent',
			fields: ['id', 'firstName', 'lastName'],
		},
		agentCompany: {
			property: 'agentCompany',
			fields: ['id', 'name'],
		},
	},
};

/**
 * Pre-defined field presets for common use cases
 */
export const AGENT_COMPANY_ASSOCIATION_FIELD_PRESETS = {
	minimal: ['id', 'agentCompanyId', 'isPrimary'],
	summary: AGENT_COMPANY_ASSOCIATION_PROJECTION_CONFIG.default,
	detail: [...AGENT_COMPANY_ASSOCIATION_PROJECTION_CONFIG.default, 'agent', 'agentCompany'],
};
