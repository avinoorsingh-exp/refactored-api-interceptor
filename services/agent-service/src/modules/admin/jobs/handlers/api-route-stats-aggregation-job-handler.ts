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
 * HARDENED ARCHITECTURE - Multiple layers of protection against gaps:
 * 
 * Runs every hour to aggregate request logs into pre-computed route statistics
 * for fast dashboard queries. Aggregates both hourly and daily buckets:
 * 
 * HOURLY BUCKETS:
 * - Previous hour (with 30-min buffer for late-arriving data) is always aggregated
 * - Last 48 hours are checked and backfilled to prevent gaps from extended failures
 * - Partial failures are isolated - one route failure doesn't stop others
 * 
 * DAILY BUCKETS (at midnight):
 * - Previous day (with 1-hour buffer for late-arriving data) is always aggregated
 * - Last 30 days are checked and backfilled (covers full trends range)
 * - Partial failures are isolated - one route failure doesn't stop others
 * 
 * PROTECTION LAYERS:
 * 1. Late-arriving data buffer: Aggregates slightly older data to catch delayed logs
 * 2. Extended backfill windows: 48h for hours, 30d for days (covers extended outages)
 * 3. Partial failure isolation: Individual route failures don't stop entire job
 * 4. Idempotent operations: Uses upsert - safe to re-run multiple times
 */
@Injectable()
export class ApiRouteStatsAggregationJobHandler implements AdminJobHandler, OnModuleInit {
	readonly name = 'api-route-stats-aggregation';
	readonly description = 'HARDENED: Aggregates API request logs into route statistics with gap prevention (hourly: 48h backfill + late-data buffer, daily: 30d backfill + late-data buffer, partial-failure isolation)';
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
	 * HARDENED EXECUTION - Multiple protection layers:
	 * 
	 * Aggregates request logs into route statistics for multiple time buckets:
	 * - Hourly buckets: Always aggregated (for 1-24 hour time ranges)
	 *   - Previous hour (with 30-min buffer) is always aggregated
	 *   - Last 48 hours are checked and backfilled to prevent gaps from extended failures
	 *   - Partial failures isolated - one route failure doesn't stop others
	 * - Daily buckets: Aggregated once per day at midnight (for > 24 hour time ranges)
	 *   - Previous day (with 1-hour buffer) is always aggregated
	 *   - Last 30 days are checked and backfilled (covers full trends range)
	 *   - Partial failures isolated - one route failure doesn't stop others
	 * 
	 * PROTECTION MECHANISMS:
	 * - Late-arriving data buffers prevent missed logs
	 * - Extended backfill windows catch gaps from extended outages
	 * - Partial failure isolation ensures maximum data capture
	 * - Idempotent upsert operations allow safe re-runs
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
			// STEP 1: Always aggregate HOUR buckets (previous hour with buffer)
			// ============================================
			// Calculate time range: previous hour with 30-minute buffer for late-arriving data
			// This ensures logs that arrive slightly late are still captured
			const endTime = new Date();
			const startTimeDate = new Date(endTime.getTime() - 90 * 60 * 1000); // 1.5 hours ago (buffer for late data)
			
			// Round down to the hour boundary for clean buckets
			startTimeDate.setMinutes(0, 0, 0);
			endTime.setMinutes(0, 0, 0);

			const previousHourBuckets = await this.apiMetricsService.aggregateAllRouteStats(
				startTimeDate,
				endTime,
				TimeBucket.HOUR,
				undefined, // Don't pass logCapture to reduce verbosity
			);

			results.hourBuckets += previousHourBuckets;

			// ============================================
			// STEP 1B: Backfill missing HOUR buckets (last 48 hours)
			// ============================================
			// Check for missing hour buckets in the last 48 hours and backfill them
			// Expanded window ensures gaps are caught even if job fails for extended period
			// This ensures no gaps accumulate if a job fails or is missed
			const backfillHourStart = new Date(endTime);
			backfillHourStart.setHours(backfillHourStart.getHours() - 48);
			backfillHourStart.setMinutes(0, 0, 0);
			const backfillHourEnd = new Date(startTimeDate);
			backfillHourEnd.setMinutes(0, 0, 0);

			// Aggregate all hours in the last 48 hours
			// The upsert logic will skip hours that already have buckets, so this is safe
			const backfillHourBuckets = await this.apiMetricsService.aggregateAllRouteStats(
				backfillHourStart,
				backfillHourEnd,
				TimeBucket.HOUR,
				undefined, // Don't pass logCapture to reduce verbosity
			);

			// Note: backfillHourBuckets includes all buckets processed (new + existing)
			// We only count new ones by tracking the previous hour separately
			// The backfill ensures completeness but doesn't double-count

			// ============================================
			// STEP 2: Aggregate DAY buckets if at midnight
			// ============================================
			// Check if we're at the start of a new day (between 00:00 and 00:10)
			// This ensures day-level aggregations are available for > 24 hour queries
			const now = new Date();
			const shouldAggregateDay = now.getHours() === 0 && now.getMinutes() < 10;

			if (shouldAggregateDay) {
				// Aggregate previous day with 1-hour buffer for late-arriving data
				// This ensures logs that arrive slightly late are still captured
				const previousDayStart = new Date(now);
				previousDayStart.setDate(previousDayStart.getDate() - 1);
				previousDayStart.setHours(0, 0, 0, 0);
				const previousDayEnd = new Date(previousDayStart);
				previousDayEnd.setDate(previousDayEnd.getDate() + 1);
				previousDayEnd.setHours(1, 0, 0, 0); // 1 hour into current day (buffer for late data)

				const previousDayBuckets = await this.apiMetricsService.aggregateAllRouteStats(
					previousDayStart,
					previousDayEnd,
					TimeBucket.DAY,
					undefined, // Don't pass logCapture to reduce verbosity
				);

				results.dayBuckets += previousDayBuckets;

				// ============================================
				// STEP 3: Backfill missing day buckets (last 30 days)
				// ============================================
				// Check for missing day buckets in the last 30 days and backfill them
				// Expanded window covers full trends range (30/60/90 days) and ensures gaps are caught
				// This ensures no gaps accumulate and handles historical data
				const backfillStart = new Date(now);
				backfillStart.setDate(backfillStart.getDate() - 30);
				backfillStart.setHours(0, 0, 0, 0);
				const backfillEnd = new Date(previousDayStart);
				backfillEnd.setHours(23, 59, 59, 999);

				// Aggregate all days in the last 30 days
				// The upsert logic will skip days that already have buckets, so this is safe
				const backfillBuckets = await this.apiMetricsService.aggregateAllRouteStats(
					backfillStart,
					backfillEnd,
					TimeBucket.DAY,
					undefined, // Don't pass logCapture to reduce verbosity
				);

				// Note: backfillBuckets includes all buckets processed (new + existing)
				// We only count new ones by tracking the previous day separately
				// The backfill ensures completeness but doesn't double-count
			}

			const executionTime = Date.now() - startTime;

			// Store concise summary - only key metrics, no verbose step-by-step logs
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
			
			// Log error concisely - only essential information
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


