import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for Office entity
 */
export const OFFICES_PROJECTION_CONFIG: ProjectionConfig = {
	// Always included (primary key)
	required: ['id'],

	// Allowed fields for projection
	allowed: [
		'id',
		'website',
		'name',
		'phone',
		'lifecycleStatus',
		'primaryState',
		'companyId',
		'created',
		'lastModified',
		'modifiedBy',
		'company',
	],

	// Default fields (when no ?fields specified)
	// This is your "summary" view
	default: [
		'id',
		'website',
		'name',
		'phone',
		'lifecycleStatus',
		'primaryState',
		'companyId',
		'created',
		'lastModified',
		'modifiedBy',
		'company',
	],

	// Available relations
	relations: {
		company: {
			property: 'company',
			fields: ['id', 'name'],
		},
	},
};

/**
 * Pre-defined field presets for common use cases
 */
export const OFFICES_FIELD_PRESETS = {
	minimal: ['id', 'name', 'lifecycleStatus'],
	summary: OFFICES_PROJECTION_CONFIG.default,
	detail: [...OFFICES_PROJECTION_CONFIG.default!, 'website', 'company'],
};
