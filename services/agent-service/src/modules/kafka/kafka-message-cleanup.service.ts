import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';

/**
 * Service for cleaning up old Kafka message processing records.
 * 
 * Runs daily to delete records older than 14 days to prevent database bloat.
 */
@Injectable()
export class KafkaMessageCleanupService {
	private readonly retentionDays: number;

	constructor(
		private readonly dataSource: DataSource,
		private readonly logger: LoggerService,
		private readonly configService: ConfigService,
	) {
		this.logger.setContext('KafkaMessageCleanupService');
		// Allow configurable retention days, default to 14
		// Use getAll() to access environment variables not in the schema
		const allConfig = this.configService.getAll();
		const retentionDaysEnv = (allConfig as Record<string, unknown>)['KAFKA_MESSAGE_RETENTION_DAYS'] as string | undefined;
		this.retentionDays = parseInt(retentionDaysEnv || '14', 10);
	}

	/**
	 * Scheduled task that runs daily at 2:00 AM UTC to clean up old Kafka message processing records.
	 * 
	 * Deletes records where created_at is older than the retention period (default 14 days).
	 * This prevents the database from storing too many Kafka message processing records.
	 */
	@Cron(CronExpression.EVERY_DAY_AT_2AM)
	async cleanupOldMessages(): Promise<void> {
		this.logger.info('Starting Kafka message processing cleanup', {
			event: 'kafka_message_cleanup_started',
			retentionDays: this.retentionDays,
		});

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

			// Delete records older than retention period
			const deleteResult = await queryRunner.query(
				`
				DELETE FROM core.kafka_message_processing
				WHERE created_at < $1
				RETURNING id
				`,
				[cutoffDate],
			);

			const deletedCount = deleteResult?.length || 0;

			await queryRunner.commitTransaction();

			this.logger.info('Kafka message processing cleanup completed', {
				event: 'kafka_message_cleanup_completed',
				retentionDays: this.retentionDays,
				cutoffDate: cutoffDate.toISOString(),
				deletedCount,
			});
		} catch (error) {
			await queryRunner.rollbackTransaction();
			this.logger.error('Kafka message processing cleanup failed', {
				event: 'kafka_message_cleanup_failed',
				retentionDays: this.retentionDays,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			// Don't throw - allow the scheduled task to continue running
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Manually trigger cleanup (useful for testing or manual cleanup).
	 * 
	 * @returns Number of records deleted
	 */
	async cleanupManually(): Promise<number> {
		this.logger.info('Manual Kafka message processing cleanup triggered', {
			event: 'kafka_message_cleanup_manual',
			retentionDays: this.retentionDays,
		});

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

			const deleteResult = await queryRunner.query(
				`
				DELETE FROM core.kafka_message_processing
				WHERE created_at < $1
				RETURNING id
				`,
				[cutoffDate],
			);

			const deletedCount = deleteResult?.length || 0;

			await queryRunner.commitTransaction();

			this.logger.info('Manual Kafka message processing cleanup completed', {
				event: 'kafka_message_cleanup_manual_completed',
				retentionDays: this.retentionDays,
				cutoffDate: cutoffDate.toISOString(),
				deletedCount,
			});

			return deletedCount;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			this.logger.error('Manual Kafka message processing cleanup failed', {
				event: 'kafka_message_cleanup_manual_failed',
				retentionDays: this.retentionDays,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		} finally {
			await queryRunner.release();
		}
	}
}

