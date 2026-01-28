import {
	Controller,
	Get,
	Query,
	Param,
	HttpCode,
	HttpStatus,
	UseGuards,
	Res,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ApiMetricsService } from './services/api-metrics.service.js';
import { TimeSeriesQueryDto } from './dto/time-series-query.dto.js';
import { ActorActivityQueryDto } from './dto/actor-activity-query.dto.js';
import { ErrorSampleQueryDto } from './dto/error-sample-query.dto.js';
import { TimeBucket, Problems } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

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
	private readonly logger: LoggerService;

	constructor(
		private readonly metricsService: ApiMetricsService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('ApiMonitoringController');
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
	async getRouteBreakdown(
		@Query('startTime') startTime: Date,
		@Query('endTime') endTime: Date,
		@Query('limit') limit?: number,
	) {
		this.logger.debug('Fetching route breakdown', {
			startTime,
			endTime,
			limit,
		});

		return this.metricsService.getRouteBreakdown(
			startTime,
			endTime,
			limit || 50,
		);
	}

	/**
	 * Get top external callers by request count.
	 */
	@Get('metrics/top-callers')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get top callers',
		description: 'Returns top external callers (actors) by request count.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Top callers statistics',
	})
	async getTopCallers(
		@Query('startTime') startTime: Date,
		@Query('endTime') endTime: Date,
		@Query('limit') limit?: number,
	) {
		this.logger.debug('Fetching top callers', {
			startTime,
			endTime,
			limit,
		});

		return this.metricsService.getTopCallers(
			startTime,
			endTime,
			limit || 20,
		);
	}

	/**
	 * Get activity for a specific actor.
	 */
	@Get('actors/:actorId/activity')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get actor activity',
		description: 'Returns recent API requests for a specific actor.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Actor activity log',
	})
	async getActorActivity(
		@Param('actorId') actorId: string,
		@Query('startTime') startTime: Date,
		@Query('endTime') endTime: Date,
		@Query('limit') limit?: number,
	) {
		this.logger.debug('Fetching actor activity', {
			actorId,
			startTime,
			endTime,
			limit,
		});

		return this.metricsService.getActorActivity({
			actorId,
			startTime,
			endTime,
			limit: limit || 100,
		});
	}

	/**
	 * Get error samples for analysis.
	 */
	@Get('errors/samples')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get error samples',
		description: 'Returns sample error logs for analysis and debugging.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Error samples',
	})
	async getErrorSamples(@Query() query: ErrorSampleQueryDto) {
		this.logger.debug('Fetching error samples', {
			startTime: query.startTime,
			endTime: query.endTime,
			classification: query.classification,
			route: query.route,
		});

		return this.metricsService.getErrorSamples(query);
	}

	/**
	 * Test endpoint to trigger rate limit violations without blocking.
	 * 
	 * This endpoint processes the request normally but returns a 429 status code,
	 * which will be logged as a rate limit violation in the API monitoring system.
	 * Useful for testing rate limit tracking and UI display.
	 */
	@Get('test/rate-limit-violation')
	@HttpCode(HttpStatus.TOO_MANY_REQUESTS)
	@ApiOperation({
		summary: 'Trigger rate limit violation (test endpoint)',
		description: 'Returns 429 status code to test rate limit violation tracking. Request is processed normally.',
	})
	@ApiResponse({
		status: HttpStatus.TOO_MANY_REQUESTS,
		description: 'Rate limit violation response for testing',
	})
	async triggerRateLimitViolation(@Res() res: Response) {
		// Process the request normally (you can add any logic here)
		const responseData = {
			message: 'This is a test rate limit violation',
			timestamp: new Date().toISOString(),
			note: 'Request was processed, but 429 status is returned for testing',
		};

		// Return 429 status with Problem Details format
		const problem = Problems.rateLimited(
			'Rate limit exceeded (test endpoint)',
			'/v1/api-monitoring/test/rate-limit-violation',
		);

		return res.status(HttpStatus.TOO_MANY_REQUESTS).json(problem);
	}
}

