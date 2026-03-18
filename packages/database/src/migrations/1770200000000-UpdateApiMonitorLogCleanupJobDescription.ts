import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Update API Monitor Log Cleanup job description.
 *
 * Purpose:
 * - Update the job description to reflect 6-month stats retention
 * - This migration is safe to run multiple times (idempotent)
 *
 * Note: The actual cleanup logic is in the job handler code.
 * This migration only updates the job description in the database.
 */
export class UpdateApiMonitorLogCleanupJobDescription1770200000000 implements MigrationInterface {
	name = 'UpdateApiMonitorLogCleanupJobDescription1770200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Update the job description to reflect 6-month stats retention
		await queryRunner.query(
			`
			UPDATE "core"."admin_job"
			SET "description" = $1,
			    "updated_at" = NOW()
			WHERE "name" = 'api-monitor-log-cleanup'
		`,
			[
				'Cleans up old API monitoring logs, stats, and anonymous actors (runs daily at 3 AM UTC). Retains 30 days of request logs, 6 months of aggregated stats, 30 days for anonymous actors.',
			],
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Revert to previous description
		await queryRunner.query(
			`
			UPDATE "core"."admin_job"
			SET "description" = $1,
			    "updated_at" = NOW()
			WHERE "name" = 'api-monitor-log-cleanup'
		`,
			[
				'Cleans up old API monitoring logs and anonymous actors (runs daily at 3 AM UTC). Retains 30 days of request logs to match aggregation backfill window, 30 days for anonymous actors.',
			],
		);
	}
}

