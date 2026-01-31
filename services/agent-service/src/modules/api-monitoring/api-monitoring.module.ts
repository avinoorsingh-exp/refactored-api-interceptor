import { Module, Global } from '@nestjs/common';
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
import { LoggerService } from '../../core/logger.service.js';

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
 * @public
 */
@Global() // Global module so interceptor can be used app-wide
@Module({
	imports: [
		TypeOrmModule.forFeature([
			ApiActorEntity,
			ApiRequestLogEntity,
			ApiRouteStatsEntity,
		]),
	],
	providers: [
		LoggerService,
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
})
export class ApiMonitoringModule {
	// Module configuration is handled via environment variables
}

