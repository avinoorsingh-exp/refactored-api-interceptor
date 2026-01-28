import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdminJobHandler, JobExecutionResult, JobLogCapture } from '../admin-job-handler.interface.js';
import { AdminJobService } from '../admin-job.service.js';
import { LoggerService } from '../../../../core/logger.service.js';
import { DataSource } from 'typeorm';

/**
 * Job handler for cleaning up old scheduled job execution logs.
 * 
 * Runs daily at 2:30 AM UTC to:
 * - Delete admin_job_execution entries older than 25 days
 * - Removes both execution records and their log outputs
 * 
 * This job maintains storage efficiency by cleaning up old execution history.
 */
@Injectable()
export class ScheduledJobsLogCleanupJobHandler implements AdminJobHandler, OnModuleInit {
	readonly name = 'scheduled-jobs-log-cleanup';
	readonly description = 'Cleans up old scheduled job execution logs and their outputs (runs daily at 2:30 AM UTC). Retains 25 days of execution history.';
	readonly cron = '30 2 * * *'; // Daily at 2:30 AM UTC
	private logCapture?: JobLogCapture;

	// Retention policy constant
	private readonly EXECUTION_LOG_RETENTION_DAYS = 25;

	constructor(
		private readonly adminJobService: AdminJobService,
		private readonly logger: LoggerService,
		private readonly dataSource: DataSource,
	) {
		this.logger.setContext('ScheduledJobsLogCleanupJobHandler');
	}

	setLogCapture(capture: JobLogCapture): void {
		this.logCapture = capture;
	}

	onModuleInit(): void {
		this.logger.info('ScheduledJobsLogCleanupJobHandler onModuleInit called', {
			name: this.name,
		});
		this.adminJobService.register(this);
		this.logger.info('ScheduledJobsLogCleanupJobHandler registered with AdminJobService', {
			name: this.name,
		});
	}

	/**
	 * Execute the cleanup job.
	 * 
	 * Deletes admin_job_execution records older than the retention period.
	 * This removes both the execution records and their associated log outputs.
	 */
	async run(): Promise<JobExecutionResult> {
		const startTime = Date.now();
		const now = new Date();
		
		// Calculate cutoff date (25 days ago)
		const executionLogCutoff = new Date(now.getTime() - this.EXECUTION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

		this.logCapture?.log('info', 'Starting scheduled jobs log cleanup', {
			retentionDays: this.EXECUTION_LOG_RETENTION_DAYS,
			cutoffDate: executionLogCutoff.toISOString(),
		});

		let deletedCount = 0;

		try {
			// Delete admin_job_execution records older than retention period
			this.logCapture?.log('info', 'Cleaning up old job execution logs', {
				cutoffDate: executionLogCutoff.toISOString(),
			});

			const deleteExecutionLogsSql = `
				DELETE FROM "core"."admin_job_execution"
				WHERE "started_at" < $1::timestamptz
			`;
			const deleteExecutionLogsParams = [executionLogCutoff.toISOString()];

			this.logCapture?.log('info', 'SQL Query: Delete old job execution logs', {
				sql: deleteExecutionLogsSql,
				parameters: deleteExecutionLogsParams,
			});

			const deleteResult = await this.dataSource.query(deleteExecutionLogsSql, deleteExecutionLogsParams);
			// PostgreSQL query result format: { command: 'DELETE', rowCount: number, ... }
			deletedCount = typeof deleteResult === 'object' && 'rowCount' in deleteResult
				? (deleteResult.rowCount as number) || 0
				: 0;

			this.logCapture?.log('info', 'Job execution log cleanup completed', {
				deletedCount,
			});

			const executionTime = Date.now() - startTime;

			this.logCapture?.log('info', 'Scheduled jobs log cleanup completed successfully', {
				deletedCount,
				executionTimeMs: executionTime,
			});

			return {
				log: JSON.stringify({
					summary: {
						deletedCount,
						cutoffDate: executionLogCutoff.toISOString(),
						executionTimeMs: executionTime,
					},
				}, null, 2),
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);

			this.logCapture?.log('error', 'Scheduled jobs log cleanup failed', {
				error: errorMessage,
				executionTimeMs: executionTime,
			});

			this.logger.error('Scheduled jobs log cleanup job failed', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				executionTimeMs: executionTime,
			});

			// Re-throw to let AdminJobService handle the failure
			throw error;
		}
	}
}


