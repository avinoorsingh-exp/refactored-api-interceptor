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
 * for fast dashboard queries. Aggregates the previous hour's data.
 */
@Injectable()
export class ApiRouteStatsAggregationJobHandler implements AdminJobHandler, OnModuleInit {
	readonly name = 'api-route-stats-aggregation';
	readonly description = 'Aggregates API request logs into route statistics for fast dashboard queries (hourly buckets)';
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
	 * Aggregates the previous hour's request logs into route statistics.
	 */
	async run(): Promise<JobExecutionResult> {
		const startTime = Date.now();
		
		// Calculate time range: previous hour (from 1 hour ago to now)
		const endTime = new Date();
		const startTimeDate = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago
		
		// Round down to the hour boundary for clean buckets
		startTimeDate.setMinutes(0, 0, 0);
		endTime.setMinutes(0, 0, 0);

		this.logCapture?.log('info', 'Starting API route stats aggregation', {
			startTime: startTimeDate.toISOString(),
			endTime: endTime.toISOString(),
			timeBucket: TimeBucket.HOUR,
		});

		try {
			const aggregatedCount = await this.apiMetricsService.aggregateAllRouteStats(
				startTimeDate,
				endTime,
				TimeBucket.HOUR,
			);

			const executionTime = Date.now() - startTime;

			this.logCapture?.log('info', 'API route stats aggregation completed', {
				aggregatedCount,
				executionTimeMs: executionTime,
			});

			return {
				log: JSON.stringify({
					summary: {
						aggregatedCount,
						startTime: startTimeDate.toISOString(),
						endTime: endTime.toISOString(),
						timeBucket: TimeBucket.HOUR,
						executionTimeMs: executionTime,
					},
				}, null, 2),
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			this.logCapture?.log('error', 'API route stats aggregation failed', {
				error: errorMessage,
				executionTimeMs: executionTime,
			});

			this.logger.error('API route stats aggregation job failed', {
				error: errorMessage,
				executionTimeMs: executionTime,
			});

			// Re-throw to let AdminJobService handle the failure
			throw error;
		}
	}
}

