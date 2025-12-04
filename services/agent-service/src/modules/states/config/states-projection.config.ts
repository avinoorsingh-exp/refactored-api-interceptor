import { ProjectionConfig } from '@exprealty/shared-domain';

/**
 * Projection configuration for State entity
 */
export const STATES_PROJECTION_CONFIG: ProjectionConfig = {
  // Always included (composite primary key)
  required: ['id'],

  // Allowed fields for projection
  allowed: [
    'id',
    'name',
    'code',
    'isActive',
    'email',
    'signatureDistributionEmail',
    'regionId',
    'countryId',
    'created',
    'lastModified',
    'modifiedBy',
    'region',
    'country',
  ],

  // Default fields (when no ?fields specified)
  // This is your "summary" view
  default: [
    'id',
    'name',
    'code',
    'isActive',
    'email',
    'signatureDistributionEmail',
    'regionId',
    'countryId',
    'created',
    'lastModified',
    'modifiedBy',
  ],

  // Available relations
  relations: {
    region: {
      property: 'region',
      fields: ['id', 'name', 'code'],
    },
    country: {
      property: 'country',
      fields: ['id', 'name', 'alpha2', 'alpha3'],
    },
  },
};

/**
 * Preset field groups for common use cases
 */
export const STATES_FIELD_PRESETS= {
  minimal: ['id', 'name', 'code'],
  summary: STATES_PROJECTION_CONFIG.default,
  detail: [
    ...STATES_PROJECTION_CONFIG.default,
    'email',
    'signatureDistributionEmail',
    'region',
    'country',
  ],
  map: ['id', 'name', 'code', 'isActive', 'regionId', 'countryId'],
};