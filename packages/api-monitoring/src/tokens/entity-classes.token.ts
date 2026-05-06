import type { Type } from '@nestjs/common';

/**
 * TypeORM entity classes supplied by the host application.
 * @public
 */
export interface ApiMonitoringEntityClasses {
	ApiRequestLogEntity: Type<unknown>;
	ApiRouteStatsEntity: Type<unknown>;
	ApiActorEntity: Type<unknown>;
	ApiMonitoringUserEntity: Type<unknown>;
}

export const API_MONITORING_ENTITY_CLASSES = Symbol('API_MONITORING_ENTITY_CLASSES');
