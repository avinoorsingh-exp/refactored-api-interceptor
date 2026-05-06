import { Global, DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ApiMonitoringInterceptor } from './interceptors/api-monitoring.interceptor.js';
import { ApiActorMiddleware } from './middleware/api-actor.middleware.js';
import { ApiRequestContextService } from './services/api-request-context.service.js';
import { ApiActorService } from './services/api-actor.service.js';
import { ApiMonitoringService } from './services/api-monitoring.service.js';
import { ApiMetricsService } from './services/api-metrics.service.js';
import { ApiMonitoringUserService } from './services/api-monitoring-user.service.js';
import { ApiMonitoringController } from './api-monitoring.controller.js';
import type { IApiMonitoringLogger } from './interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from './interfaces/logger.interface.js';
import { API_MONITORING_ASYNC_CONTEXT } from './interfaces/async-context.port.js';
import { API_MONITORING_ENTITY_CLASSES } from './tokens/entity-classes.token.js';
import { DEFAULT_API_MONITORING_ENTITIES } from './entities/default-entities.js';
import type { ApiMonitoringForRootOptions } from './options/api-monitoring-for-root.options.js';
import {
	API_MONITORING_ACTOR_REPO,
	API_MONITORING_REQUEST_LOG_REPO,
	API_MONITORING_ROUTE_STATS_REPO,
	API_MONITORING_USER_REPO,
} from './tokens/repository.tokens.js';
import {
	API_MONITORING_MODULE_OPTIONS,
	type ApiMonitoringModuleRuntimeOptions,
} from './tokens/api-monitoring-module-options.token.js';

/**
 * Nest module that registers API monitoring (entities, repos, global interceptor, admin controller).
 * Import once via {@link ApiMonitoringModule.forRoot}.
 * @public
 */
@Global()
export class ApiMonitoringModule {
	/**
	 * Builds the dynamic module: wires TypeORM feature entities, DI tokens for repositories,
	 * logger + async context from the host, runtime options, services, global HTTP interceptor,
	 * and read-only metrics routes.
	 */
	static forRoot(options: ApiMonitoringForRootOptions): DynamicModule {
		// Entity bundle (defaults or host override for custom classes / same tables).
		const entities = options.entities ?? DEFAULT_API_MONITORING_ENTITIES;
		const { ApiRequestLogEntity, ApiRouteStatsEntity, ApiActorEntity, ApiMonitoringUserEntity } =
			entities;
		const connection = options.dataSourceName;

		// Register monitoring entities on the default or named TypeORM connection.
		const forFeature = connection
			? TypeOrmModule.forFeature(
					[ApiRequestLogEntity, ApiRouteStatsEntity, ApiActorEntity, ApiMonitoringUserEntity],
					connection,
				)
			: TypeOrmModule.forFeature([
					ApiRequestLogEntity,
					ApiRouteStatsEntity,
					ApiActorEntity,
					ApiMonitoringUserEntity,
				]);

		// Repository injection tokens for each entity (respect named connection when set).
		const requestLogToken = connection
			? getRepositoryToken(ApiRequestLogEntity, connection)
			: getRepositoryToken(ApiRequestLogEntity);
		const routeStatsToken = connection
			? getRepositoryToken(ApiRouteStatsEntity, connection)
			: getRepositoryToken(ApiRouteStatsEntity);
		const actorToken = connection
			? getRepositoryToken(ApiActorEntity, connection)
			: getRepositoryToken(ApiActorEntity);
		const monitoringUserToken = connection
			? getRepositoryToken(ApiMonitoringUserEntity, connection)
			: getRepositoryToken(ApiMonitoringUserEntity);

		// Resolved flags passed to the interceptor (body capture limits, optional outcome headers).
		const maxBytesRaw = options.requestBodyMaxBytes ?? 16_384;
		const runtimeOptions: ApiMonitoringModuleRuntimeOptions = {
			captureRequestBody: options.captureRequestBody === true,
			requestBodyMaxBytes: Math.min(1_048_576, Math.max(256, maxBytesRaw)),
			exposeRequestLogOutcomeHeaders: options.exposeRequestLogOutcomeHeaders !== false,
		};

		return {
			module: ApiMonitoringModule,
			imports: [forFeature],
			providers: [
				{ provide: API_MONITORING_MODULE_OPTIONS, useValue: runtimeOptions }, // Interceptor reads capture + headers.
				{ provide: API_MONITORING_ENTITY_CLASSES, useValue: entities }, // Metrics queries use entity metadata.
				{
					provide: API_MONITORING_ASYNC_CONTEXT,
					useClass: options.asyncContext, // Host ALS adapter: correlation id and request store.
				},
				{
					provide: API_MONITORING_LOGGER_TOKEN,
					useFactory: (logger: IApiMonitoringLogger) => logger, // Bridge host logger token into injectable token.
					inject: [options.logger],
				},
				{
					provide: API_MONITORING_REQUEST_LOG_REPO,
					// Alias TypeORM repo → stable symbol for ApiMonitoringService.
					useFactory: (repo: Repository<Record<string, unknown>>): Repository<Record<string, unknown>> =>
						repo,
					inject: [requestLogToken],
				},
				{
					provide: API_MONITORING_ROUTE_STATS_REPO,
					useFactory: (repo: Repository<Record<string, unknown>>): Repository<Record<string, unknown>> =>
						repo,
					inject: [routeStatsToken],
				},
				{
					provide: API_MONITORING_ACTOR_REPO,
					useFactory: (repo: Repository<Record<string, unknown>>): Repository<Record<string, unknown>> =>
						repo,
					inject: [actorToken],
				},
				{
					provide: API_MONITORING_USER_REPO,
					useFactory: (repo: Repository<Record<string, unknown>>): Repository<Record<string, unknown>> =>
						repo,
					inject: [monitoringUserToken],
				},
				ApiRequestContextService, // Reads/writes actor + correlation on async store.
				ApiActorService, // getOrCreateActor → api_actor.
				ApiMonitoringUserService, // USER profile upsert → api_monitoring_user.
				ApiMonitoringService, // buildRequestMetadata + logRequest → api_request_log.
				ApiMetricsService, // Dashboard queries + optional route_stats aggregation.
				ApiActorMiddleware, // Apply on routes in host; attributes actors after auth.
				{
					provide: APP_INTERCEPTOR,
					useClass: ApiMonitoringInterceptor, // Global: measure + persist api_request_log after handlers.
				},
			],
			controllers: [ApiMonitoringController], // Admin metrics GET routes (protect in host).
			exports: [
				// Let host modules inject middleware / services for ordering or extension.
				ApiRequestContextService,
				ApiActorService,
				ApiMonitoringUserService,
				ApiMonitoringService,
				ApiMetricsService,
				ApiActorMiddleware,
			],
		};
	}
}
