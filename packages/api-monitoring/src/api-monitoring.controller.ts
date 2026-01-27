import {
	Controller,
	Get,
	Query,
	Param,
	HttpCode,
	HttpStatus,
	UseGuards,
	Inject,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiMetricsService } from './services/api-metrics.service.js';
import { TimeSeriesQueryDto } from './dto/time-series-query.dto.js';
import { ActorActivityQueryDto } from './dto/actor-activity-query.dto.js';
import { ErrorSampleQueryDto } from './dto/error-sample-query.dto.js';
import { RouteBreakdownQueryDto } from './dto/route-breakdown-query.dto.js';
import { PaginatedErrorSampleResponseDto } from './dto/paginated-error-sample-response.dto.js';
import { PaginatedActorActivityResponseDto } from './dto/paginated-actor-activity-response.dto.js';
import { PaginatedTopCallersResponseDto } from './dto/paginated-top-callers-response.dto.js';
import { TopCallersQueryDto } from './dto/top-callers-query.dto.js';
import { SummaryResponseDto } from './dto/summary-response.dto.js';
import { AggregationResponseDto } from './dto/aggregation-response.dto.js';
import { TimeBucket, HttpMethod } from '@exprealty/shared-domain';
import type { IApiMonitoringLogger } from './interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from './interfaces/logger.interface.js';

/**
 * API Monitoring Controller
 * 
 * Internal-only endpoints for API metrics and observability dashboards.
 * These endpoints should be protected by role-based access control.
 * 
 * Endpoints:
 * - GET /v1/api-monitoring/metrics/time-series - Time-series metrics
 * - GET /v1/api-monitoring/metrics/routes - Per-route breakdown
 * - GET /v1/api-monitoring/metrics/top-callers - Top external callers
 * - GET /v1/api-monitoring/actors/:actorId/activity - Actor activity
 * - GET /v1/api-monitoring/errors/samples - Error samples
 * 
 * @public
 */
@ApiTags('api-monitoring')
@Controller('v1/api-monitoring')
@ApiBearerAuth()
// TODO: Add role-based guard (e.g., @UseGuards(RolesGuard))
// @Roles('admin', 'monitoring')
export class ApiMonitoringController {
	private readonly logger: IApiMonitoringLogger;

	constructor(
		private readonly metricsService: ApiMetricsService,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiMonitoringController');
		this.logger.info('ApiMonitoringController initialized successfully');
	}

	/**
	 * Get time-series metrics for routes.
	 * Returns aggregated statistics grouped by time bucket.
	 */
	@Get('metrics/time-series')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get time-series metrics',
		description: 'Returns aggregated API metrics grouped by time bucket (minute/hour/day).',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Time-series metrics',
	})
	async getTimeSeriesMetrics(@Query() query: TimeSeriesQueryDto) {
		this.logger.debug('Fetching time-series metrics', {
			startTime: query.startTime,
			endTime: query.endTime,
			route: query.route,
			method: query.method,
		});

		return this.metricsService.getTimeSeriesMetrics({
			startTime: query.startTime,
			endTime: query.endTime,
			route: query.route,
			method: query.method,
			timeBucket: query.timeBucket || TimeBucket.HOUR,
			actorId: query.actorId,
		});
	}

	/**
	 * Get per-route breakdown with aggregated statistics.
	 */
	@Get('metrics/routes')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get route breakdown',
		description: 'Returns aggregated statistics per route (request count, error rate, latency percentiles).',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Route breakdown statistics',
	})
	async getRouteBreakdown(@Query() query: RouteBreakdownQueryDto) {
		// Default to last 15 minutes if not provided (same as summary endpoint)
		// Ensure dates are proper Date objects (handle string conversion from query params)
		const endTime = query.endTime 
			? (query.endTime instanceof Date ? query.endTime : new Date(query.endTime))
			: new Date();
		const startTime = query.startTime
			? (query.startTime instanceof Date ? query.startTime : new Date(query.startTime))
			: new Date(endTime.getTime() - 15 * 60 * 1000);

		this.logger.debug('Fetching route breakdown', {
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			limit: query.limit,
			startTimeType: typeof startTime,
			endTimeType: typeof endTime,
		});

		return this.metricsService.getRouteBreakdown(
			startTime,
			endTime,
			query.limit || 50,
		);
	}

	/**
	 * Get top external callers by request count.
	 * 
	 * Supports pagination with hard max limit (default 25, max 100).
	 * If no pagination params are provided, returns array (backward compatible).
	 */
	@Get('metrics/top-callers')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get top callers',
		description: 'Returns top external callers (actors) by request count. Supports cursor-based pagination.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Top callers statistics (paginated or array)',
		type: PaginatedTopCallersResponseDto,
	})
	async getTopCallers(@Query() query: TopCallersQueryDto) {
		console.log('=== TOP CALLERS CONTROLLER CALLED ===');
		console.log('Query:', JSON.stringify(query, null, 2));
		
		// Convert string dates to Date objects
		const startTime = new Date(query.startTime);
		const endTime = new Date(query.endTime);
		
		console.log('Parsed dates:', { startTime: startTime.toISOString(), endTime: endTime.toISOString() });

		this.logger.info('Fetching top callers', {
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			limit: query.limit,
			cursor: query.cursor ? 'present' : 'none',
		});

		try {
			const result = await this.metricsService.getTopCallers(
				startTime,
				endTime,
				query.limit,
				query.cursor,
			);
			console.log('Service returned:', JSON.stringify(result, null, 2));
			return result;
		} catch (error) {
			console.error('Controller error:', error);
			throw error;
		}
	}

	/**
	 * Get activity for a specific actor.
	 * 
	 * Supports cursor-based pagination.
	 * If no pagination params are provided, returns array (backward compatible).
	 */
	@Get('actors/:actorId/activity')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get actor activity',
		description: 'Returns recent API requests for a specific actor. Supports cursor-based pagination.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Actor activity log (paginated or array)',
		type: PaginatedActorActivityResponseDto,
	})
	async getActorActivity(
		@Param('actorId') actorId: string,
		@Query() query: ActorActivityQueryDto,
	) {
		this.logger.debug('Fetching actor activity', {
			actorId,
			startTime: query.startTime,
			endTime: query.endTime,
			limit: query.limit,
			cursor: query.cursor ? 'present' : 'none',
		});

		return this.metricsService.getActorActivity({
			actorId,
			startTime: query.startTime,
			endTime: query.endTime,
			limit: query.limit || query.legacyLimit,
			cursor: query.cursor,
		});
	}

	/**
	 * Get error samples for analysis.
	 * 
	 * Supports cursor-based pagination with filtering by:
	 * - route
	 * - classification (severity)
	 * - statusCode
	 * 
	 * If no pagination params are provided, returns array (backward compatible).
	 */
	@Get('errors/samples')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get error samples',
		description: 'Returns sample error logs for analysis and debugging. Supports cursor-based pagination.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Error samples (paginated or array)',
		type: PaginatedErrorSampleResponseDto,
	})
	async getErrorSamples(@Query() query: ErrorSampleQueryDto) {
		this.logger.debug('Fetching error samples', {
			startTime: query.startTime,
			endTime: query.endTime,
			classification: query.classification,
			route: query.route,
			statusCode: query.statusCode,
			limit: query.limit || query.legacyLimit,
			cursor: query.cursor ? 'present' : 'none',
		});

		return this.metricsService.getErrorSamples({
			startTime: query.startTime,
			endTime: query.endTime,
			classification: query.classification,
			route: query.route,
			limit: query.limit || query.legacyLimit || 50, // Use limit from ErrorSampleQuery
			cursor: query.cursor,
			statusCode: query.statusCode,
			legacyLimit: query.legacyLimit,
		});
	}

	/**
	 * Get summary metrics for the Admin header.
	 * 
	 * Returns aggregated metrics in a single DB round-trip:
	 * - totalRequests
	 * - errorRate
	 * - p95Latency
	 * - activeActors (unique in time window)
	 * - activeRateLimitViolations
	 * 
	 * Time window defaults to last 15 minutes if not provided.
	 */
	@Get('summary')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get summary metrics',
		description: 'Returns aggregated metrics for the Admin header (total requests, error rate, latency, active actors, rate limit violations).',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Summary metrics',
		type: SummaryResponseDto,
	})
	async getSummary(
		@Query('from') from?: Date,
		@Query('to') to?: Date,
	) {
		this.logger.debug('Fetching summary metrics', {
			from,
			to,
		});

		return this.metricsService.getSummary(from, to);
	}

	/**
	 * Trigger aggregation of route statistics.
	 * 
	 * This endpoint manually triggers aggregation of route statistics
	 * for the given time range and stores them in the api_route_stats table.
	 * This is useful for populating the time-series metrics endpoint.
	 * 
	 * @param startTime - Start of time range (defaults to 24 hours ago)
	 * @param endTime - End of time range (defaults to now)
	 * @param timeBucket - Time bucket size (defaults to HOUR)
	 * @returns Number of route stats records created
	 */
	@Get('aggregate')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Trigger route stats aggregation',
		description: 'Manually triggers aggregation of route statistics for the given time range. Populates the api_route_stats table for time-series metrics.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Aggregation result',
		type: AggregationResponseDto,
	})
	async triggerAggregation(
		@Query('startTime') startTime?: Date,
		@Query('endTime') endTime?: Date,
		@Query('timeBucket') timeBucket?: string,
	) {
		// Default to last 24 hours if not provided
		const endTimeDate = endTime || new Date();
		const startTimeDate = startTime || new Date(endTimeDate.getTime() - 24 * 60 * 60 * 1000);
		// Convert string to TimeBucket enum, defaulting to HOUR
		const bucket = (timeBucket && Object.values(TimeBucket).includes(timeBucket as TimeBucket))
			? (timeBucket as TimeBucket)
			: TimeBucket.HOUR;

		this.logger.info('Triggering route stats aggregation', {
			startTime: startTimeDate.toISOString(),
			endTime: endTimeDate.toISOString(),
			timeBucket: bucket,
		});

		const aggregatedCount = await this.metricsService.aggregateAllRouteStats(
			startTimeDate,
			endTimeDate,
			bucket,
		);

		return {
			aggregatedCount,
			startTime: startTimeDate.toISOString(),
			endTime: endTimeDate.toISOString(),
			timeBucket: bucket,
		};
	}
}

