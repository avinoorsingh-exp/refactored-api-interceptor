import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdminJobHandler, JobExecutionResult, JobLogCapture } from '../admin-job-handler.interface.js';
import { AdminJobService } from '../admin-job.service.js';
import { LoggerService } from '../../../../core/logger.service.js';
import { DataSource } from 'typeorm';

/**
 * Job handler for cleaning up old API monitoring data.
 * 
 * Runs daily at 3 AM UTC to:
 * 1. Delete api_request_log entries older than retention period (30 days)
 *    - Matches the daily bucket backfill window to prevent data loss
 *    - Ensures aggregation job has full 30-day window to backfill daily buckets
 * 2. Delete api_route_stats entries older than retention period (6 months)
 *    - Aggregated stats are kept longer than raw logs for historical analysis
 *    - Supports long-term trend analysis and reporting
 * 3. Delete anonymous actors that have no references and are older than 30 days
 * 4. Deactivate actors with no recent activity (90+ days)
 *    - Soft delete (sets active = false) to preserve historical attribution
 *    - Excludes SYSTEM actors (keeps system actors active)
 *    - Only deactivates if no recent request logs exist
 * 
 * This job maintains storage efficiency while preserving attribution and aggregates.
 * Retention period aligns with aggregation job's 30-day daily bucket backfill window.
 */
@Injectable()
export class ApiMonitorLogCleanupJobHandler implements AdminJobHandler, OnModuleInit {
	readonly name = 'api-monitor-log-cleanup';
	readonly description = 'Cleans up old API monitoring logs, stats, and actors (runs daily at 3 AM UTC). Retains 30 days of request logs, 6 months of aggregated stats, 30 days for anonymous actors. Deactivates actors with no activity for 90+ days.';
	readonly cron = '0 3 * * *'; // Daily at 3 AM UTC
	private logCapture?: JobLogCapture;

	// Retention policy constants
	// IMPORTANT: 30 days matches the aggregation job's daily bucket backfill window
	// This ensures logs are available for the full 30-day backfill period
	private readonly REQUEST_LOG_RETENTION_DAYS = 30;
	private readonly REQUEST_LOG_MAX_RETENTION_DAYS = 30;
	private readonly ROUTE_STATS_RETENTION_DAYS = 180; // 6 months (30 days * 6)
	private readonly ANONYMOUS_ACTOR_RETENTION_DAYS = 30;
	private readonly INACTIVE_ACTOR_RETENTION_DAYS = 90; // Deactivate actors with no activity for 90+ days

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

	/**
	 * Extract affected row count from TypeORM/pg query result.
	 * TypeORM returns DELETE/UPDATE as [rows, rowCount]; raw pg returns { rowCount }.
	 * rowCount may be number or string depending on driver version.
	 */
	private getAffectedRowCount(result: unknown): number {
		if (Array.isArray(result) && result.length >= 2) {
			const count = result[1];
			return typeof count === 'number' ? count : parseInt(String(count), 10) || 0;
		}
		if (result != null && typeof result === 'object' && 'rowCount' in result) {
			const count = (result as { rowCount: number | string }).rowCount;
			return typeof count === 'number' ? count : parseInt(String(count), 10) || 0;
		}
		return 0;
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
	 * 2. Clean up api_route_stats (older than retention period)
	 * 3. Clean up anonymous actors (no references, older than retention)
	 * 4. Deactivate actors with no recent activity (90+ days)
	 */
	async run(): Promise<JobExecutionResult> {
		const startTime = Date.now();
		const now = new Date();
		
		// Calculate cutoff dates
		const requestLogCutoff = new Date(now.getTime() - this.REQUEST_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const requestLogMaxCutoff = new Date(now.getTime() - this.REQUEST_LOG_MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const routeStatsCutoff = new Date(now.getTime() - this.ROUTE_STATS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const anonymousActorCutoff = new Date(now.getTime() - this.ANONYMOUS_ACTOR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const inactiveActorCutoff = new Date(now.getTime() - this.INACTIVE_ACTOR_RETENTION_DAYS * 24 * 60 * 60 * 1000);

		this.logCapture?.log('info', 'Starting API monitor log cleanup', {
			requestLogRetentionDays: this.REQUEST_LOG_RETENTION_DAYS,
			requestLogMaxRetentionDays: this.REQUEST_LOG_MAX_RETENTION_DAYS,
			routeStatsRetentionDays: this.ROUTE_STATS_RETENTION_DAYS,
			anonymousActorRetentionDays: this.ANONYMOUS_ACTOR_RETENTION_DAYS,
			inactiveActorRetentionDays: this.INACTIVE_ACTOR_RETENTION_DAYS,
			requestLogCutoff: requestLogCutoff.toISOString(),
			requestLogMaxCutoff: requestLogMaxCutoff.toISOString(),
			routeStatsCutoff: routeStatsCutoff.toISOString(),
			anonymousActorCutoff: anonymousActorCutoff.toISOString(),
			inactiveActorCutoff: inactiveActorCutoff.toISOString(),
		});

		const results = {
			step1_requestLogCleanup: { deletedCount: 0 },
			step2_routeStatsCleanup: { deletedCount: 0 },
			step3_anonymousActorCleanup: { deletedCount: 0 },
			step4_inactiveActorDeactivation: { deactivatedCount: 0 },
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
			// TypeORM returns DELETE as [rows, rowCount]; pg driver may return { rowCount }. Normalize to number.
			results.step1_requestLogCleanup.deletedCount = this.getAffectedRowCount(requestLogResult);

			this.logCapture?.log('info', 'STEP 1 completed: Request log cleanup', {
				deletedCount: results.step1_requestLogCleanup.deletedCount,
			});

			// STEP 2: Clean up api_route_stats (older than retention period)
			this.logCapture?.log('info', 'STEP 2: Cleaning up api_route_stats', {
				cutoffDate: routeStatsCutoff.toISOString(),
			});

			const routeStatsCleanupSql = `
				DELETE FROM "core"."api_route_stats"
				WHERE "bucket_start" < $1::timestamptz
			`;
			const routeStatsParams = [routeStatsCutoff.toISOString()];

			const queryStart2 = Date.now();
			const routeStatsResult = await this.dataSource.query(routeStatsCleanupSql, routeStatsParams);
			const queryDuration2 = Date.now() - queryStart2;

			// Log SQL query using logQuery() to match Kafka cleanup format (type: 'query')
			this.logCapture?.logQuery(routeStatsCleanupSql, routeStatsParams, queryDuration2);
			results.step2_routeStatsCleanup.deletedCount = this.getAffectedRowCount(routeStatsResult);

			this.logCapture?.log('info', 'STEP 2 completed: Route stats cleanup', {
				deletedCount: results.step2_routeStatsCleanup.deletedCount,
			});

			// STEP 3: Clean up anonymous actors (only after logs are cleaned)
			// Delete anonymous actors that:
			// - Have type = 'anonymous'
			// - Have no references in api_request_log
			// - Have last activity (updated_at) older than retention period
			this.logCapture?.log('info', 'STEP 3: Cleaning up anonymous actors', {
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

			const queryStart3 = Date.now();
			const anonymousActorResult = await this.dataSource.query(anonymousActorCleanupSql, anonymousActorParams);
			const queryDuration3 = Date.now() - queryStart3;

			// Log SQL query using logQuery() to match Kafka cleanup format (type: 'query')
			this.logCapture?.logQuery(anonymousActorCleanupSql, anonymousActorParams, queryDuration3);
			results.step3_anonymousActorCleanup.deletedCount = this.getAffectedRowCount(anonymousActorResult);

			this.logCapture?.log('info', 'STEP 3 completed: Anonymous actor cleanup', {
				deletedCount: results.step3_anonymousActorCleanup.deletedCount,
			});

			// STEP 4: Deactivate actors with no recent activity
			// This is a soft delete - we don't delete, just mark inactive
			// Deactivates actors that:
			// - Are currently active
			// - Are not SYSTEM actors (keep system actors active)
			// - Have not been updated in the last 90 days
			// - Have no recent request logs (last 90 days)
			this.logCapture?.log('info', 'STEP 4: Deactivating inactive actors', {
				cutoffDate: inactiveActorCutoff.toISOString(),
			});

			const deactivateInactiveActorsSql = `
				UPDATE "core"."api_actor" AS "actor"
				SET "active" = false
				WHERE "actor"."active" = true
					AND "actor"."type" != 'system'
					AND "actor"."updated_at" < $1::timestamptz
					AND NOT EXISTS (
						SELECT 1
						FROM "core"."api_request_log" AS "log"
						WHERE "log"."actor_id" = "actor"."id"
							AND "log"."timestamp" >= $1::timestamptz
					)
			`;
			const inactiveActorParams = [inactiveActorCutoff.toISOString()];

			const queryStart4 = Date.now();
			const inactiveActorResult = await this.dataSource.query(deactivateInactiveActorsSql, inactiveActorParams);
			const queryDuration4 = Date.now() - queryStart4;

			// Log SQL query using logQuery() to match Kafka cleanup format (type: 'query')
			this.logCapture?.logQuery(deactivateInactiveActorsSql, inactiveActorParams, queryDuration4);
			results.step4_inactiveActorDeactivation.deactivatedCount = this.getAffectedRowCount(inactiveActorResult);

			this.logCapture?.log('info', 'STEP 4 completed: Inactive actor deactivation', {
				deactivatedCount: results.step4_inactiveActorDeactivation.deactivatedCount,
			});

			const executionTime = Date.now() - startTime;
			const totalDeleted = results.step1_requestLogCleanup.deletedCount + 
			                     results.step2_routeStatsCleanup.deletedCount + 
			                     results.step3_anonymousActorCleanup.deletedCount;
			const totalDeactivated = results.step4_inactiveActorDeactivation.deactivatedCount;

			this.logCapture?.log('info', 'API monitor log cleanup completed', {
				totalDeleted,
				totalDeactivated,
				executionTimeMs: executionTime,
			});

			return {
				log: JSON.stringify({
					summary: {
						requestLogDeleted: results.step1_requestLogCleanup.deletedCount,
						routeStatsDeleted: results.step2_routeStatsCleanup.deletedCount,
						anonymousActorsDeleted: results.step3_anonymousActorCleanup.deletedCount,
						inactiveActorsDeactivated: results.step4_inactiveActorDeactivation.deactivatedCount,
						totalDeleted,
						totalDeactivated,
						requestLogCutoff: requestLogCutoff.toISOString(),
						routeStatsCutoff: routeStatsCutoff.toISOString(),
						anonymousActorCutoff: anonymousActorCutoff.toISOString(),
						inactiveActorCutoff: inactiveActorCutoff.toISOString(),
						executionTimeMs: executionTime,
					},
				}, null, 2),
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			this.logCapture?.log('error', 'API monitor log cleanup failed', {
				error: errorMessage,
				requestLogDeleted: results.step1_requestLogCleanup.deletedCount,
				routeStatsDeleted: results.step2_routeStatsCleanup.deletedCount,
				anonymousActorsDeleted: results.step3_anonymousActorCleanup.deletedCount,
				inactiveActorsDeactivated: results.step4_inactiveActorDeactivation.deactivatedCount,
				executionTimeMs: executionTime,
			});

			this.logger.error('API monitor log cleanup job failed', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				requestLogDeleted: results.step1_requestLogCleanup.deletedCount,
				routeStatsDeleted: results.step2_routeStatsCleanup.deletedCount,
				anonymousActorsDeleted: results.step3_anonymousActorCleanup.deletedCount,
				inactiveActorsDeactivated: results.step4_inactiveActorDeactivation.deactivatedCount,
				executionTimeMs: executionTime,
			});

			// Re-throw to let AdminJobService handle the failure
			throw error;
		}
	}
}

