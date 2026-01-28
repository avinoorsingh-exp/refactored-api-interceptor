import { Injectable, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { AdminJobHandler, JobExecutionResult, JobLogCapture } from '../admin-job-handler.interface.js';
import { AdminJobService } from '../admin-job.service.js';
import { LoggerService } from '../../../../core/logger.service.js';
import { ApiMetricsService } from '@exprealty/api-monitoring';
import { TimeBucket } from '@exprealty/shared-domain';

/**
 * Job handler for aggregating API route statistics.
 * 
 * Runs every hour to aggregate request logs into pre-computed route statistics
 * for fast dashboard queries. Aggregates both hourly and daily buckets:
 * - Hourly buckets: Aggregated every hour for 1-24 hour time ranges
 * - Daily buckets: Aggregated once per day (at midnight) for > 24 hour time ranges
 */
@Injectable()
export class ApiRouteStatsAggregationJobHandler implements AdminJobHandler, OnModuleInit {
	readonly name = 'api-route-stats-aggregation';
	readonly description = 'Aggregates API request logs into route statistics for fast dashboard queries (hourly and daily buckets)';
	readonly cron = '0 5 * * * *'; // Every hour at :05 (5 minutes past the hour)
	private logCapture?: JobLogCapture;

	constructor(
		private readonly adminJobService: AdminJobService,
		private readonly apiMetricsService: ApiMetricsService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('ApiRouteStatsAggregationJobHandler');
	}

	setLogCapture(capture: JobLogCapture): void {
		this.logCapture = capture;
	}

	onModuleInit(): void {
		this.logger.info('ApiRouteStatsAggregationJobHandler onModuleInit called', {
			name: this.name,
		});
		this.adminJobService.register(this);
		this.logger.info('ApiRouteStatsAggregationJobHandler registered with AdminJobService', {
			name: this.name,
		});
	}

	/**
	 * Execute the aggregation job.
	 * 
	 * Aggregates request logs into route statistics for multiple time buckets:
	 * - Hourly buckets: Always aggregated (for 1-24 hour time ranges)
	 * - Daily buckets: Aggregated once per day at midnight (for > 24 hour time ranges)
	 */
	async run(): Promise<JobExecutionResult> {
		const startTime = Date.now();
		const results: {
			hourBuckets: number;
			dayBuckets: number;
		} = {
			hourBuckets: 0,
			dayBuckets: 0,
		};

		try {
			// ============================================
			// STEP 1: Always aggregate HOUR buckets
			// ============================================
			// Calculate time range: previous hour (from 1 hour ago to now)
			const endTime = new Date();
			const startTimeDate = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago
			
			// Round down to the hour boundary for clean buckets
			startTimeDate.setMinutes(0, 0, 0);
			endTime.setMinutes(0, 0, 0);

			this.logCapture?.log('info', 'Starting API route stats aggregation (hourly buckets)', {
				startTime: startTimeDate.toISOString(),
				endTime: endTime.toISOString(),
				timeBucket: TimeBucket.HOUR,
			});

			results.hourBuckets = await this.apiMetricsService.aggregateAllRouteStats(
				startTimeDate,
				endTime,
				TimeBucket.HOUR,
			);

			this.logCapture?.log('info', 'Hourly bucket aggregation completed', {
				aggregatedCount: results.hourBuckets,
			});

			// ============================================
			// STEP 2: Aggregate DAY buckets if at midnight
			// ============================================
			// Check if we're at the start of a new day (between 00:00 and 00:10)
			// This ensures day-level aggregations are available for > 24 hour queries
			const now = new Date();
			const shouldAggregateDay = now.getHours() === 0 && now.getMinutes() < 10;

			if (shouldAggregateDay) {
				// Aggregate previous day
				const dayStart = new Date(now);
				dayStart.setDate(dayStart.getDate() - 1);
				dayStart.setHours(0, 0, 0, 0);
				const dayEnd = new Date(dayStart);
				dayEnd.setHours(23, 59, 59, 999);

				this.logCapture?.log('info', 'Starting API route stats aggregation (daily buckets)', {
					startTime: dayStart.toISOString(),
					endTime: dayEnd.toISOString(),
					timeBucket: TimeBucket.DAY,
				});

				results.dayBuckets = await this.apiMetricsService.aggregateAllRouteStats(
					dayStart,
					dayEnd,
					TimeBucket.DAY,
				);

				this.logCapture?.log('info', 'Daily bucket aggregation completed', {
					aggregatedCount: results.dayBuckets,
				});
			}

			const executionTime = Date.now() - startTime;

			this.logCapture?.log('info', 'API route stats aggregation completed', {
				hourBuckets: results.hourBuckets,
				dayBuckets: results.dayBuckets,
				executionTimeMs: executionTime,
			});

			return {
				log: JSON.stringify({
					summary: {
						hourBuckets: results.hourBuckets,
						dayBuckets: results.dayBuckets,
						hourlyRange: {
							startTime: startTimeDate.toISOString(),
							endTime: endTime.toISOString(),
						},
						executionTimeMs: executionTime,
					},
				}, null, 2),
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			this.logCapture?.log('error', 'API route stats aggregation failed', {
				error: errorMessage,
				hourBuckets: results.hourBuckets,
				dayBuckets: results.dayBuckets,
				executionTimeMs: executionTime,
			});

			this.logger.error('API route stats aggregation job failed', {
				error: errorMessage,
				hourBuckets: results.hourBuckets,
				dayBuckets: results.dayBuckets,
				executionTimeMs: executionTime,
			});

			// Re-throw to let AdminJobService handle the failure
			throw error;
		}
	}
}


