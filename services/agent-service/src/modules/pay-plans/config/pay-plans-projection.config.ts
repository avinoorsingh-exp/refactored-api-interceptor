import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for PayPlan entity
 */
export const PAY_PLANS_PROJECTION_CONFIG: ProjectionConfig = {
	// Always included (primary key + default sort field)
	required: ['id', 'name'],

	// Allowed fields for projection
	allowed: [
		'id',
		'name',
		'active',
		'agentPercentage',
		'cap',
		'created',
		'lastModified',
		'modifiedBy',
		'payPlanVariants',
	],

	// Default fields (when no ?fields specified)
	// This is your "summary" view
	default: [
		'id',
		'name',
		'active',
		'agentPercentage',
		'cap',
		'created',
		'lastModified',
		'modifiedBy',
	],

	// Available relations (singular names following GraphQL conventions)
	relations: {
		payPlanVariant: {
			property: 'payPlanVariants',
			fields: ['id', 'name'],
		},
	},
};

/**
 * Pre-defined field presets for common use cases
 */
export const PAY_PLANS_FIELD_PRESETS = {
	minimal: ['id', 'name', 'active'],
	summary: PAY_PLANS_PROJECTION_CONFIG.default,
	detail: [...PAY_PLANS_PROJECTION_CONFIG.default, 'payPlanVariant'],
};
