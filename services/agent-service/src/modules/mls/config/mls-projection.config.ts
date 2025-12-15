import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for MLS entity
 */
export const MLS_PROJECTION_CONFIG: ProjectionConfig = {
	// Always included (primary key)
	required: ['id'],

	// Allowed fields for projection
	allowed: [
		'id',
		'ouid',
		'globalId',
		'lifecycleStatus',
		'name',
		'shortName',
		'website',
		'orgType',
		'kunversionUrl',
		'addressId',
		'created',
		'lastModified',
		'modifiedBy',
		'address',
	],

	// Default fields (when no ?fields specified)
	// This is your "summary" view
	default: [
		'id',
		'ouid',
		'globalId',
		'lifecycleStatus',
		'name',
		'shortName',
		'website',
		'orgType',
		'kunversionUrl',
		'addressId',
		'created',
		'lastModified',
		'modifiedBy',
	],

	// Available relations
	relations: {
		address: {
			property: 'address',
			fields: ['id', 'street', 'city', 'state', 'zipCode'],
		},
	},
};
