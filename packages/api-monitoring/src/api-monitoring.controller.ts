import {
	Controller,
	Get,
	Query,
	Param,
	HttpCode,
	HttpStatus,
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
import { TrendsQueryDto, TrendsRange } from './dto/trends-query.dto.js';
import { TrendsResponseDto } from './dto/trends-response.dto.js';
import { AvailableRoutesQueryDto } from './dto/available-routes-query.dto.js';
import { AvailableRoutesResponseDto } from './dto/available-routes-response.dto.js';
import { TimeBucket } from './domain/api-monitoring.types.js';
import type { IApiMonitoringLogger } from './interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from './interfaces/logger.interface.js';
import type { PaginatedResponse } from './utils/pagination.util.js';

function paginationLimitFromQuery(query: {
	limit?: number;
	/** @deprecated Prefer `limit`. */
	legacyLimit?: number;
}): number | undefined {
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- backward-compatible `legacyLimit` query alias
	return query.limit ?? query.legacyLimit;
}

/**
 * API Monitoring Controller
 * 
 * Internal-only endpoints for API metrics and observability dashboards.
 * These endpoints should be protected by role-based access control.
 * 
 * Endpoints:
 * - GET /v1/api-monitoring/summary - Summary metrics for admin header
 * - GET /v1/api-monitoring/metrics/time-series - Time-series metrics
 * - GET /v1/api-monitoring/metrics/routes - Per-route breakdown
 * - GET /v1/api-monitoring/metrics/top-callers - Top external callers
 * - GET /v1/api-monitoring/trends - Long-term trends (30/60/90 days)
 * - GET /v1/api-monitoring/actors/:actorId/activity - Actor activity
 * - GET /v1/api-monitoring/errors/samples - Error samples
 * - GET /v1/api-monitoring/routes/available - Available routes and error codes
 * - GET /v1/api-monitoring/aggregate - Manual aggregation trigger
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
		operationId: 'getTimeSeriesMetrics',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Time-series metrics',
	})
	async getTimeSeriesMetrics(@Query() query: TimeSeriesQueryDto): Promise<unknown[]> {
		// Convert string dates to Date objects if needed (query params come as strings)
		const startTime = query.startTime instanceof Date 
			? query.startTime 
			: new Date(query.startTime);
		const endTime = query.endTime instanceof Date 
			? query.endTime 
			: new Date(query.endTime);

		// Validate dates are valid
		if (isNaN(startTime.getTime())) {
			throw new Error(`Invalid startTime: ${String(query.startTime)}`);
		}
		if (isNaN(endTime.getTime())) {
			throw new Error(`Invalid endTime: ${String(query.endTime)}`);
		}

		this.logger.debug('Fetching time-series metrics', {
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			route: query.route,
			method: query.method,
		});

		return this.metricsService.getTimeSeriesMetrics({
			startTime,
			endTime,
			route: query.route,
			method: query.method,
			timeBucket: query.timeBucket,
			actorId: query.actorId,
			statusCode: query.statusCode,
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
		operationId: 'getRouteBreakdown',
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

		// Parse debug mode (optional, non-breaking)
		const debug = query.debug === true;

		this.logger.debug('Fetching route breakdown', {
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			limit: query.limit,
			debug,
		});

		// Default limit is 50 (ranking mode), but service will auto-detect inspection mode
		const limit = query.limit || 50;
		
		return this.metricsService.getRouteBreakdown(
			startTime,
			endTime,
			limit,
			query.route,
			query.method,
			query.statusCode,
			debug,
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
		operationId: 'getTopCallers',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Top callers statistics (paginated or array)',
		type: PaginatedTopCallersResponseDto,
	})
	async getTopCallers(@Query() query: TopCallersQueryDto) {
		// Convert string dates to Date objects if provided
		// Note: startTime and endTime are optional in DTO but required by service
		// If not provided, we'll use defaults (last 24 hours)
		const now = new Date();
		const defaultStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
		
		const startTime = query.startTime 
			? (typeof query.startTime === 'string' ? new Date(query.startTime) : query.startTime as Date)
			: defaultStartTime;
		const endTime = query.endTime 
			? (typeof query.endTime === 'string' ? new Date(query.endTime) : query.endTime as Date)
			: now;

		// Validate dates
		if (isNaN(startTime.getTime())) {
			throw new Error(`Invalid startTime: ${String(query.startTime)}`);
		}
		if (isNaN(endTime.getTime())) {
			throw new Error(`Invalid endTime: ${String(query.endTime)}`);
		}

		// Parse debug mode (optional, non-breaking)
		const debug = query.debug === true;

		this.logger.info('Fetching top callers', {
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			limit: query.limit,
			cursor: query.cursor ? 'present' : 'none',
			debug,
		});

		try {
			const result = await this.metricsService.getTopCallers(
				startTime,
				endTime,
				query.limit,
				query.cursor,
				query.actorId,
				query.route,
				query.statusCode,
				debug,
			);
			return result;
		} catch (error) {
			this.logger.error('Failed to fetch top callers', {
				error: error instanceof Error ? error.message : String(error),
			});
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
	): Promise<PaginatedResponse<unknown> | unknown[]> {
		// Parse debug mode (optional, non-breaking)
		const debug = query.debug === true;

		this.logger.debug('Fetching actor activity', {
			actorId,
			startTime: query.startTime,
			endTime: query.endTime,
			limit: paginationLimitFromQuery(query),
			cursor: query.cursor ? 'present' : 'none',
			debug,
		});

		return this.metricsService.getActorActivity({
			actorId,
			startTime: query.startTime,
			endTime: query.endTime,
			limit: paginationLimitFromQuery(query),
			cursor: query.cursor,
			route: query.route,
			statusCode: query.statusCode,
			debug,
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
		operationId: 'getErrorSamples',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Error samples (paginated or array)',
		type: PaginatedErrorSampleResponseDto,
	})
	async getErrorSamples(@Query() query: ErrorSampleQueryDto): Promise<PaginatedResponse<unknown> | unknown[]> {
		// Parse debug mode (optional, non-breaking)
		const debug = query.debug === true;

		this.logger.debug('Fetching error samples', {
			startTime: query.startTime,
			endTime: query.endTime,
			classification: query.classification,
			route: query.route,
			statusCode: query.statusCode,
			limit: paginationLimitFromQuery(query),
			cursor: query.cursor ? 'present' : 'none',
			debug,
		});

		// eslint-disable-next-line @typescript-eslint/no-deprecated -- forwarded to metrics for limit normalization parity
		const legacyLimitParam = query.legacyLimit;

		return this.metricsService.getErrorSamples({
			startTime: query.startTime,
			endTime: query.endTime,
			classification: query.classification,
			route: query.route,
			limit: paginationLimitFromQuery(query) ?? 50,
			cursor: query.cursor,
			statusCode: query.statusCode,
			legacyLimit: legacyLimitParam,
			debug,
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
		@Query('from') from?: string,
		@Query('to') to?: string,
	) {
		// Convert string dates to Date objects
		const fromDate = from ? new Date(from) : undefined;
		const toDate = to ? new Date(to) : undefined;

		this.logger.debug('Fetching summary metrics', {
			from: fromDate?.toISOString(),
			to: toDate?.toISOString(),
		});

		return this.metricsService.getSummary(fromDate, toDate);
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
		@Query('startTime') startTime?: string | Date,
		@Query('endTime') endTime?: string | Date,
		@Query('timeBucket') timeBucket?: string,
	) {
		// Parse date strings to Date objects if needed (query params come as strings)
		const endTimeDate = endTime 
			? (endTime instanceof Date ? endTime : new Date(endTime))
			: new Date();
		const startTimeDate = startTime
			? (startTime instanceof Date ? startTime : new Date(startTime))
			: new Date(endTimeDate.getTime() - 24 * 60 * 60 * 1000);

		// Validate dates are valid
		if (isNaN(startTimeDate.getTime())) {
			throw new Error(`Invalid startTime: ${String(startTime)}`);
		}
		if (isNaN(endTimeDate.getTime())) {
			throw new Error(`Invalid endTime: ${String(endTime)}`);
		}

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

	/**
	 * Get trends metrics for long-term analysis.
	 * 
	 * Fixed ranges: 30, 60, 90 days.
	 * Uses daily buckets for ranges ≤14 days, weekly buckets for ranges >14 days.
	 * Queries only aggregated tables (api_route_stats), never raw request logs.
	 * 
	 * Returns time-bucketed metrics and KPI summary with period-over-period deltas.
	 */
	@Get('trends')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get trends metrics',
		description: 'Returns long-term trend metrics for fixed ranges (30, 60, 90 days) with time-bucketed data and KPI summary. Uses daily buckets for ≤14 days, weekly buckets for >14 days.',
		operationId: 'getTrendsMetrics',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Trends metrics with time-bucketed data and KPI summary',
		type: TrendsResponseDto,
	})
	async getTrendsMetrics(@Query() query: TrendsQueryDto): Promise<TrendsResponseDto> {
		// Ensure range is properly transformed (handle case where Transform decorator might not run)
		let range: TrendsRange;
		const rangeValue = query.range as unknown;
		if (typeof rangeValue === 'string') {
			const num = parseInt(rangeValue.replace('d', ''), 10);
			if (num === 30 || num === 60 || num === 90) {
				range = num;
			} else {
				throw new Error(`Invalid range: ${rangeValue}. Must be 30d, 60d, 90d, 30, 60, or 90`);
			}
		} else if (typeof rangeValue === 'number') {
			range = rangeValue;
		} else {
			throw new Error(`Invalid range type: ${typeof rangeValue}`);
		}

		this.logger.debug('Fetching trends metrics', {
			range,
			routes: query.route,
			method: query.method,
			statusCodes: query.statusCode,
		});

		return this.metricsService.getTrendsMetrics(
			range,
			query.route,
			query.method,
			query.statusCode,
		);
	}

	/**
	 * Get all available distinct routes and error codes for a given time window.
	 * 
	 * Queries the aggregated api_route_stats table to return:
	 * - All distinct route paths available in the time window
	 * - All distinct status codes (extracted from status_code_counts JSONB field)
	 * 
	 * This endpoint is designed to populate frontend filter dropdowns consistently.
	 * Defaults to last 30 days if no time window is provided.
	 * 
	 * Uses efficient queries with indexes on bucket_start for performance.
	 */
	@Get('routes/available')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get available routes and error codes',
		description: 'Returns all distinct routes and status codes available in api_route_stats for the given time window. Defaults to last 30 days if no dates provided.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Available routes and error codes',
		type: AvailableRoutesResponseDto,
	})
	async getAvailableRoutesAndErrorCodes(
		@Query() query: AvailableRoutesQueryDto,
	): Promise<AvailableRoutesResponseDto> {
		this.logger.debug('Fetching available routes and error codes', {
			startDate: query.startDate,
			endDate: query.endDate,
		});

		return this.metricsService.getAvailableRoutesAndErrorCodes(
			query.startDate,
			query.endDate,
		);
	}
}

