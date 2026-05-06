import type { ApiMonitoringEntityClasses } from '../tokens/entity-classes.token.js';
import { ApiActorEntity } from './api-actor.entity.js';
import { ApiMonitoringUserEntity } from './api-monitoring-user.entity.js';
import { ApiRequestLogEntity } from './api-request-log.entity.js';
import { ApiRouteStatsEntity } from './api-route-stats.entity.js';

/**
 * Built-in TypeORM entity classes. Use when you do not need custom entity classes.
 * @public
 */
export const DEFAULT_API_MONITORING_ENTITIES: ApiMonitoringEntityClasses = {
	ApiRequestLogEntity,
	ApiRouteStatsEntity,
	ApiActorEntity,
	ApiMonitoringUserEntity,
};

/**
 * Array of the default API monitoring entity classes, for `TypeOrmModule.forRoot({ entities: [ ... ] })` or `dataSource: { entities: [ ... ] } }`.
 * Each application registers its own database URL; the same entity definitions apply to every database.
 * @public
 */
export const API_MONITORING_TYPEORM_ENTITIES = [
	ApiRequestLogEntity,
	ApiRouteStatsEntity,
	ApiActorEntity,
	ApiMonitoringUserEntity,
] as const;
