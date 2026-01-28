import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdminJobHandler, JobExecutionResult, JobLogCapture } from '../admin-job-handler.interface.js';
import { AdminJobService } from '../admin-job.service.js';
import { LoggerService } from '../../../../core/logger.service.js';
import { DataSource } from 'typeorm';

/**
 * Job handler for cleaning up old API monitoring data.
 * 
 * Runs daily at 3 AM UTC to:
 * 1. Delete api_request_log entries older than retention period (14 days, max 30 days)
 * 2. Delete anonymous actors that have no references and are older than 30 days
 * 3. Optionally mark actors inactive if they have no recent activity
 * 
 * This job maintains storage efficiency while preserving attribution and aggregates.
 */
@Injectable()
export class ApiMonitorLogCleanupJobHandler implements AdminJobHandler, OnModuleInit {
	readonly name = 'api-monitor-log-cleanup';
	readonly description = 'Cleans up old API monitoring logs and anonymous actors (runs daily at 3 AM UTC)';
	readonly cron = '0 3 * * *'; // Daily at 3 AM UTC
	private logCapture?: JobLogCapture;

	// Retention policy constants
	private readonly REQUEST_LOG_RETENTION_DAYS = 14;
	private readonly REQUEST_LOG_MAX_RETENTION_DAYS = 30;
	private readonly ANONYMOUS_ACTOR_RETENTION_DAYS = 30;

	constructor(
		private readonly adminJobService: AdminJobService,
		private readonly logger: LoggerService,
		private readonly dataSource: DataSource,
	) {
		this.logger.setContext('ApiMonitorLogCleanupJobHandler');
	}

	setLogCapture(capture: JobLogCapture): void {
		this.logCapture = capture;
	}

	onModuleInit(): void {
		this.logger.info('ApiMonitorLogCleanupJobHandler onModuleInit called', {
			name: this.name,
		});
		this.adminJobService.register(this);
		this.logger.info('ApiMonitorLogCleanupJobHandler registered with AdminJobService', {
			name: this.name,
		});
	}

	/**
	 * Execute the cleanup job.
	 * 
	 * Runs in this order:
	 * 1. Clean up api_request_log (older than retention period)
	 * 2. Clean up anonymous actors (no references, older than retention)
	 * 3. Optionally update actor activity status
	 */
	async run(): Promise<JobExecutionResult> {
		const startTime = Date.now();
		const now = new Date();
		
		// Calculate cutoff dates
		const requestLogCutoff = new Date(now.getTime() - this.REQUEST_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const requestLogMaxCutoff = new Date(now.getTime() - this.REQUEST_LOG_MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const anonymousActorCutoff = new Date(now.getTime() - this.ANONYMOUS_ACTOR_RETENTION_DAYS * 24 * 60 * 60 * 1000);

		this.logCapture?.log('info', 'Starting API monitor log cleanup', {
			requestLogRetentionDays: this.REQUEST_LOG_RETENTION_DAYS,
			requestLogMaxRetentionDays: this.REQUEST_LOG_MAX_RETENTION_DAYS,
			anonymousActorRetentionDays: this.ANONYMOUS_ACTOR_RETENTION_DAYS,
			requestLogCutoff: requestLogCutoff.toISOString(),
			requestLogMaxCutoff: requestLogMaxCutoff.toISOString(),
			anonymousActorCutoff: anonymousActorCutoff.toISOString(),
		});

		const results = {
			step1_requestLogCleanup: { deletedCount: 0 },
			step2_anonymousActorCleanup: { deletedCount: 0 },
		};

		try {
			// STEP 1: Clean up api_request_log
			this.logCapture?.log('info', 'STEP 1: Cleaning up api_request_log', {
				cutoffDate: requestLogCutoff.toISOString(),
			});

			const requestLogCleanupSql = `
				DELETE FROM "core"."api_request_log"
				WHERE "timestamp" < $1::timestamptz
			`;
			const requestLogParams = [requestLogCutoff.toISOString()];

			const queryStart1 = Date.now();
			const requestLogResult = await this.dataSource.query(requestLogCleanupSql, requestLogParams);
			const queryDuration1 = Date.now() - queryStart1;

			// Log SQL query using logQuery() to match Kafka cleanup format (type: 'query')
			this.logCapture?.logQuery(requestLogCleanupSql, requestLogParams, queryDuration1);
			// PostgreSQL query result format: { command: 'DELETE', rowCount: number, ... }
			results.step1_requestLogCleanup.deletedCount = typeof requestLogResult === 'object' && 'rowCount' in requestLogResult
				? (requestLogResult.rowCount as number) || 0
				: 0;

			this.logCapture?.log('info', 'STEP 1 completed: Request log cleanup', {
				deletedCount: results.step1_requestLogCleanup.deletedCount,
			});

			// STEP 2: Clean up anonymous actors (only after logs are cleaned)
			// Delete anonymous actors that:
			// - Have type = 'anonymous'
			// - Have no references in api_request_log
			// - Have last activity (updated_at) older than retention period
			this.logCapture?.log('info', 'STEP 2: Cleaning up anonymous actors', {
				cutoffDate: anonymousActorCutoff.toISOString(),
			});

			// Use NOT EXISTS for better performance than NOT IN
			const anonymousActorCleanupSql = `
				DELETE FROM "core"."api_actor" AS "actor"
				WHERE "actor"."type" = 'anonymous'
					AND "actor"."updated_at" < $1::timestamptz
					AND NOT EXISTS (
						SELECT 1
						FROM "core"."api_request_log" AS "log"
						WHERE "log"."actor_id" = "actor"."id"
					)
			`;
			const anonymousActorParams = [anonymousActorCutoff.toISOString()];

			const queryStart2 = Date.now();
			const anonymousActorResult = await this.dataSource.query(anonymousActorCleanupSql, anonymousActorParams);
			const queryDuration2 = Date.now() - queryStart2;

			// Log SQL query using logQuery() to match Kafka cleanup format (type: 'query')
			this.logCapture?.logQuery(anonymousActorCleanupSql, anonymousActorParams, queryDuration2);
			// PostgreSQL query result format: { command: 'DELETE', rowCount: number, ... }
			results.step2_anonymousActorCleanup.deletedCount = typeof anonymousActorResult === 'object' && 'rowCount' in anonymousActorResult
				? (anonymousActorResult.rowCount as number) || 0
				: 0;

			this.logCapture?.log('info', 'STEP 2 completed: Anonymous actor cleanup', {
				deletedCount: results.step2_anonymousActorCleanup.deletedCount,
			});

			// STEP 3: Optional - Mark actors inactive if no recent activity
			// This is a soft delete - we don't delete, just mark inactive
			// For now, we'll skip this step as it's optional

			const executionTime = Date.now() - startTime;
			const totalDeleted = results.step1_requestLogCleanup.deletedCount + results.step2_anonymousActorCleanup.deletedCount;

			this.logCapture?.log('info', 'API monitor log cleanup completed', {
				totalDeleted,
				executionTimeMs: executionTime,
			});

			return {
				log: JSON.stringify({
					summary: {
						requestLogDeleted: results.step1_requestLogCleanup.deletedCount,
						anonymousActorsDeleted: results.step2_anonymousActorCleanup.deletedCount,
						totalDeleted,
						requestLogCutoff: requestLogCutoff.toISOString(),
						anonymousActorCutoff: anonymousActorCutoff.toISOString(),
						executionTimeMs: executionTime,
					},
				}, null, 2),
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			this.logCapture?.log('error', 'API monitor log cleanup failed', {
				error: errorMessage,
				executionTimeMs: executionTime,
			});

			this.logger.error('API monitor log cleanup job failed', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				executionTimeMs: executionTime,
			});

			// Re-throw to let AdminJobService handle the failure
			throw error;
		}
	}
}

