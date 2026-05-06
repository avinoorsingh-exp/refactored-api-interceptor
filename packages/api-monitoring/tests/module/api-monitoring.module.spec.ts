import { APP_INTERCEPTOR } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { API_MONITORING_ASYNC_CONTEXT, IApiMonitoringAsyncContext } from '../../src/interfaces/async-context.port.js';
import { IApiMonitoringLogger, API_MONITORING_LOGGER_TOKEN } from '../../src/interfaces/logger.interface.js';
import { ApiMonitoringModule } from '../../src/api-monitoring.module.js';
import { DEFAULT_API_MONITORING_ENTITIES, API_MONITORING_TYPEORM_ENTITIES } from '../../src/entities/default-entities.js';
import { ApiRequestLogEntity } from '../../src/entities/api-request-log.entity.js';
import { ApiRouteStatsEntity } from '../../src/entities/api-route-stats.entity.js';
import { ApiActorEntity } from '../../src/entities/api-actor.entity.js';
import { ApiMonitoringUserEntity } from '../../src/entities/api-monitoring-user.entity.js';
import {
	API_MONITORING_ACTOR_REPO,
	API_MONITORING_REQUEST_LOG_REPO,
	API_MONITORING_ROUTE_STATS_REPO,
	API_MONITORING_USER_REPO,
} from '../../src/tokens/repository.tokens.js';
import { API_MONITORING_ENTITY_CLASSES } from '../../src/tokens/entity-classes.token.js';
import { ApiMonitoringController } from '../../src/api-monitoring.controller.js';
import { ApiMonitoringInterceptor } from '../../src/interceptors/api-monitoring.interceptor.js';
import { API_MONITORING_MODULE_OPTIONS } from '../../src/tokens/api-monitoring-module-options.token.js';

class MockLogger implements IApiMonitoringLogger {
	setContext = jest.fn();
	debug = jest.fn();
	info = jest.fn();
	warn = jest.fn();
	error = jest.fn();
}

class MockAsyncContext implements IApiMonitoringAsyncContext {
	getStore = jest.fn().mockReturnValue(undefined);
	getCorrelationId = jest.fn().mockReturnValue(undefined);
}

describe('ApiMonitoringModule.forRoot', () => {
	const findBySymbol = (providers: any[], sym: symbol) => providers.find((p) => p && p.provide === sym);
	const findByToken = (providers: any[], token: any) => providers.find((p) => p && p.provide === token);

	it('registers the controller, default entities, and global request interceptor', () => {
		const mod = ApiMonitoringModule.forRoot({
			logger: MockLogger,
			asyncContext: MockAsyncContext,
		});

		expect(mod.module).toBe(ApiMonitoringModule);
		expect(mod.controllers).toEqual([ApiMonitoringController]);

		const providers: any[] = mod.providers as any[];
		const entityProv = findByToken(providers, API_MONITORING_ENTITY_CLASSES);
		expect(entityProv).toBeDefined();
		expect(entityProv.useValue).toBe(DEFAULT_API_MONITORING_ENTITIES);
		expect(findByToken(providers, API_MONITORING_ASYNC_CONTEXT)).toMatchObject({ useClass: MockAsyncContext });
		const logTok = findByToken(providers, API_MONITORING_LOGGER_TOKEN);
		expect(logTok).toMatchObject({ inject: [MockLogger] });
		const modOpts = findByToken(providers, API_MONITORING_MODULE_OPTIONS);
		expect(modOpts).toEqual({
			provide: API_MONITORING_MODULE_OPTIONS,
			useValue: { captureRequestBody: false, requestBodyMaxBytes: 16_384 },
		});
		const appInter = findByToken(providers, APP_INTERCEPTOR);
		expect(appInter).toEqual({ provide: APP_INTERCEPTOR, useClass: ApiMonitoringInterceptor });

		const logRepo = findBySymbol(providers, API_MONITORING_REQUEST_LOG_REPO) as { inject: unknown[] };
		expect(logRepo.inject[0]).toBe(getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiRequestLogEntity));
		const statsRepo = findBySymbol(providers, API_MONITORING_ROUTE_STATS_REPO) as { inject: unknown[] };
		expect(statsRepo.inject[0]).toBe(
			getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiRouteStatsEntity),
		);
		const actorRepo = findBySymbol(providers, API_MONITORING_ACTOR_REPO) as { inject: unknown[] };
		expect(actorRepo.inject[0]).toBe(getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiActorEntity));
		const userRepo = findBySymbol(providers, API_MONITORING_USER_REPO) as { inject: unknown[] };
		expect(userRepo.inject[0]).toBe(getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiMonitoringUserEntity));
	});

	it('uses explicit entities when provided instead of defaults', () => {
		const custom = {
			ApiRequestLogEntity: ApiRequestLogEntity,
			ApiRouteStatsEntity: ApiRouteStatsEntity,
			ApiActorEntity: ApiActorEntity,
			ApiMonitoringUserEntity: ApiMonitoringUserEntity,
		} as const;

		const mod = ApiMonitoringModule.forRoot({
			logger: MockLogger,
			asyncContext: MockAsyncContext,
			entities: custom,
		});

		const entityProv = (mod.providers as any[]).find((p) => p && p.provide === API_MONITORING_ENTITY_CLASSES);
		expect(entityProv.useValue).toBe(custom);
	});

	it('wires a single forFeature import when dataSourceName is omitted', () => {
		const mod = ApiMonitoringModule.forRoot({
			logger: MockLogger,
			asyncContext: MockAsyncContext,
		});
		expect((mod.imports as unknown as unknown[]).length).toBe(1);
		const dyn = (mod.imports as unknown as { module?: unknown; imports?: unknown[] }[])[0] as
			| { module?: unknown }
			| undefined;
		// @nestjs TypeOrmModule.forFeature returns a dynamic import definition (object)
		expect(dyn).toBeTruthy();
	});

	it('wires TypeOrmModule forFeature to a named connection and matching repository tokens', () => {
		const conn = 'app-metrics';
		const mod = ApiMonitoringModule.forRoot({
			logger: MockLogger,
			asyncContext: MockAsyncContext,
			dataSourceName: conn,
		});
		const providers: any[] = mod.providers as any[];
		const logRepo = findBySymbol(providers, API_MONITORING_REQUEST_LOG_REPO) as { inject: unknown[] };
		expect(logRepo.inject[0]).toBe(getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiRequestLogEntity, conn));
		const routeRepo = findBySymbol(providers, API_MONITORING_ROUTE_STATS_REPO) as { inject: unknown[] };
		expect(routeRepo.inject[0]).toBe(
			getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiRouteStatsEntity, conn),
		);
		const actorR = findBySymbol(providers, API_MONITORING_ACTOR_REPO) as { inject: unknown[] };
		expect(actorR.inject[0]).toBe(getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiActorEntity, conn));
		const userR = findBySymbol(providers, API_MONITORING_USER_REPO) as { inject: unknown[] };
		expect(userR.inject[0]).toBe(
			getRepositoryToken(DEFAULT_API_MONITORING_ENTITIES.ApiMonitoringUserEntity, conn),
		);
	});

	it('clamps requestBodyMaxBytes and enables capture when configured', () => {
		const mod = ApiMonitoringModule.forRoot({
			logger: MockLogger,
			asyncContext: MockAsyncContext,
			captureRequestBody: true,
			requestBodyMaxBytes: 99,
		});
		const modOpts = (mod.providers as any[]).find((p) => p && p.provide === API_MONITORING_MODULE_OPTIONS);
		expect(modOpts.useValue).toEqual({ captureRequestBody: true, requestBodyMaxBytes: 256 });
	});

	it('clamps requestBodyMaxBytes to upper bound 1048576', () => {
		const mod = ApiMonitoringModule.forRoot({
			logger: MockLogger,
			asyncContext: MockAsyncContext,
			requestBodyMaxBytes: 9_999_999,
		});
		const modOpts = (mod.providers as any[]).find((p) => p && p.provide === API_MONITORING_MODULE_OPTIONS);
		expect(modOpts.useValue).toEqual({ captureRequestBody: false, requestBodyMaxBytes: 1_048_576 });
	});

	it('exposes the services and actor middleware to host modules', () => {
		const { exports: ex } = ApiMonitoringModule.forRoot({
			logger: MockLogger,
			asyncContext: MockAsyncContext,
		});
		const names = (ex as (string | object)[]).map((c) =>
			typeof c === 'function' && c.name ? c.name : typeof c === 'string' ? c : '[export]',
		);
		expect(names.some((n) => n.includes('ApiMonitoringService'))).toBe(true);
		expect(names.some((n) => n.includes('ApiMetricsService'))).toBe(true);
		expect(names.some((n) => n.includes('ApiMonitoringUserService'))).toBe(true);
	});
});

describe('default entity bundle', () => {
	it('API_MONITORING_TYPEORM_ENTITIES lists all four class constructors', () => {
		expect([...API_MONITORING_TYPEORM_ENTITIES]).toEqual([
			ApiRequestLogEntity,
			ApiRouteStatsEntity,
			ApiActorEntity,
			ApiMonitoringUserEntity,
		]);
	});

	it('DEFAULT_API_MONITORING_ENTITIES uses the same entity types as the array', () => {
		expect(DEFAULT_API_MONITORING_ENTITIES.ApiRequestLogEntity).toBe(ApiRequestLogEntity);
		expect(DEFAULT_API_MONITORING_ENTITIES.ApiRouteStatsEntity).toBe(ApiRouteStatsEntity);
		expect(DEFAULT_API_MONITORING_ENTITIES.ApiActorEntity).toBe(ApiActorEntity);
		expect(DEFAULT_API_MONITORING_ENTITIES.ApiMonitoringUserEntity).toBe(ApiMonitoringUserEntity);
	});
});
