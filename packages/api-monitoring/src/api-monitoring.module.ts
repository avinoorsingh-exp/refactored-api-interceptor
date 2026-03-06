import { Module, Global, DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	ApiActorEntity,
	ApiRequestLogEntity,
	ApiRouteStatsEntity,
} from '@exprealty/database';
import { ApiMonitoringInterceptor } from './interceptors/api-monitoring.interceptor.js';
import { ApiActorMiddleware } from './middleware/api-actor.middleware.js';
import { ApiRequestContextService } from './services/api-request-context.service.js';
import { ApiActorService } from './services/api-actor.service.js';
import { ApiMonitoringService } from './services/api-monitoring.service.js';
import { ApiMetricsService } from './services/api-metrics.service.js';
import { ApiMonitoringController } from './api-monitoring.controller.js';
import type { IApiMonitoringLogger } from './interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from './interfaces/logger.interface.js';

/**
 * API Monitoring Module
 * 
 * Provides comprehensive API request monitoring, metrics, and observability.
 * 
 * Architecture:
 * - ApiMonitoringInterceptor: Global interceptor for all HTTP requests
 * - ApiActorMiddleware: Attributes requests to actors (users, API keys, etc.)
 * - ApiMonitoringService: Logs requests asynchronously (non-blocking)
 * - ApiMetricsService: Aggregates and queries metrics
 * - ApiMonitoringController: Internal endpoints for dashboards
 * 
 * Features:
 * - High-volume, append-only request logging
 * - Actor attribution (users, API keys, service accounts)
 * - Error classification and PII-safe logging
 * - Time-series metrics aggregation
 * - Latency percentile tracking
 * - Security monitoring (suspicious behavior detection)
 * 
 * Performance:
 * - All logging is asynchronous and non-blocking
 * - Monitoring failures never break requests
 * - Supports sampling for high-throughput scenarios
 * - Background aggregation for fast dashboard queries
 * 
 * Configuration (Environment Variables):
 * - API_MONITORING_ENABLED: Enable/disable monitoring (default: true)
 * - API_MONITORING_SAMPLE_RATE: Sampling rate 0.0-1.0 (default: 1.0)
 * 
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     ApiMonitoringModule.forRoot({
 *       logger: MyLoggerService, // Your logger implementation
 *     }),
 *   ],
 * })
 * export class MyModule {}
 * ```
 * 
 * @public
 */
@Global() // Global module so interceptor can be used app-wide
export class ApiMonitoringModule {
	/**
	 * Register the API monitoring module with a logger provider.
	 * 
	 * @param options - Configuration options
	 * @param options.logger - Logger service that implements IApiMonitoringLogger
	 * @returns Dynamic module configuration
	 */
	static forRoot(options: { logger: any }): DynamicModule {
		// LoggerService is now bootstrap-safe (no dependencies in constructor)
		// Since LoggerModule is @Global() and imported first, we can use useExisting
		// to reference the same instance that LoggerModule provides
		return {
			module: ApiMonitoringModule,
			imports: [
				TypeOrmModule.forFeature([
					ApiActorEntity,
					ApiRequestLogEntity,
					ApiRouteStatsEntity,
				]),
			],
			providers: [
				// Reference LoggerService from the global LoggerModule
				// Since LoggerModule is @Global() and imported first, LoggerService is available
				// We use useFactory to ensure LoggerService is resolved from the DI container
				{
					provide: API_MONITORING_LOGGER_TOKEN,
					useFactory: (loggerService: IApiMonitoringLogger) => {
						return loggerService;
					},
					inject: [options.logger],
				},
				ApiRequestContextService,
				ApiActorService,
				ApiMonitoringService,
				ApiMetricsService,
				ApiActorMiddleware,
				{
					provide: APP_INTERCEPTOR,
					useClass: ApiMonitoringInterceptor,
				},
			],
			controllers: [ApiMonitoringController],
			exports: [
				ApiRequestContextService,
				ApiActorService,
				ApiMonitoringService,
				ApiMetricsService,
				ApiActorMiddleware,
			],
		};
	}
}

