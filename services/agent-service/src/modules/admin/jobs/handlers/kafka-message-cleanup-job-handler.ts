import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminJobHandler, JobExecutionResult, JobLogCapture } from '../admin-job-handler.interface.js';
import { AdminJobService } from '../admin-job.service.js';
import { KafkaMessageCleanupService } from '../../../kafka/kafka-message-cleanup.service.js';
import { LoggerService } from '../../../../core/logger.service.js';
import { DataSource } from 'typeorm';

/**
 * Job handler wrapper for Kafka message cleanup.
 * Integrates the existing KafkaMessageCleanupService with AdminJobService.
 */
@Injectable()
export class KafkaMessageCleanupJobHandler implements AdminJobHandler, OnModuleInit {
	readonly name = 'kafka-message-cleanup';
	readonly description = 'Cleans up old Kafka message processing records older than retention period';
	readonly cron = CronExpression.EVERY_DAY_AT_2AM;
	private logCapture?: JobLogCapture;

	constructor(
		private readonly adminJobService: AdminJobService,
		private readonly kafkaMessageCleanupService: KafkaMessageCleanupService,
		private readonly logger: LoggerService,
		private readonly dataSource: DataSource,
	) {
		this.logger.setContext('KafkaMessageCleanupJobHandler');
	}

	setLogCapture(capture: JobLogCapture): void {
		this.logCapture = capture;
	}

	onModuleInit(): void {
		this.logger.info('KafkaMessageCleanupJobHandler onModuleInit called', {
			name: this.name,
		});
		this.adminJobService.register(this);
		this.logger.info('KafkaMessageCleanupJobHandler registered with AdminJobService', {
			name: this.name,
		});
	}

	/**
	 * Execute the cleanup job.
	 * This method is called by the @Cron decorator.
	 * It checks if the job is enabled, then delegates to AdminJobService for execution tracking.
	 */
	@Cron(CronExpression.EVERY_DAY_AT_2AM, {
		name: 'kafka-message-cleanup',
	})
	async run(): Promise<void> {
		const job = await this.adminJobService.getJob(this.name);
		if (!job || !job.enabled) {
			this.logger.debug('Job is disabled, skipping execution', { name: this.name });
			return;
		}

		await this.adminJobService.executeJob(this.name);
	}

	/**
	 * Internal method that performs the actual cleanup work.
	 * Called by AdminJobService.executeJob after execution tracking is set up.
	 * Returns execution details for logging.
	 */
	async execute(): Promise<JobExecutionResult> {
		// Pass log capture to cleanup service to capture queries and logs
		const result = await this.kafkaMessageCleanupService.cleanupOldMessages(this.logCapture);
		
		// Return execution summary (detailed logs are already captured)
		return {
			log: JSON.stringify({
				summary: {
					deletedCount: result.deletedCount,
					retentionDays: result.retentionDays,
					cutoffDate: result.cutoffDate,
					executionTime: result.executionTime,
				},
			}, null, 2),
		};
	}
}

