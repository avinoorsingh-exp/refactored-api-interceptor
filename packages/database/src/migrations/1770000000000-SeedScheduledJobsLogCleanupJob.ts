import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed Scheduled Jobs Log Cleanup job.
 *
 * Purpose:
 * - Insert admin job definition for cleaning up old scheduled job execution logs
 * - Runs daily at 2:30 AM UTC to remove execution records older than 25 days
 * - Maintains storage efficiency by cleaning up old execution history
 *
 * Retention Policy:
 * - admin_job_execution: 25 days
 * - Removes both execution records and their log outputs
 *
 * Note: This migration is idempotent - it uses ON CONFLICT DO NOTHING.
 */
export class SeedScheduledJobsLogCleanupJob1770000000000 implements MigrationInterface {
	name = 'SeedScheduledJobsLogCleanupJob1770000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Insert Scheduled Jobs Log Cleanup Job
		await queryRunner.query(
			`
			INSERT INTO "core"."admin_job" ("name", "description", "cron_expression", "enabled", "run_count", "failure_count", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, 0, 0, NOW(), NOW())
			ON CONFLICT ("name") DO NOTHING
		`,
			[
				'scheduled-jobs-log-cleanup',
				'Cleans up old scheduled job execution logs and their outputs (runs daily at 2:30 AM UTC). Retains 25 days of execution history.',
				'30 2 * * *', // Daily at 2:30 AM UTC
			],
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove seeded job
		await queryRunner.query(
			`
			DELETE FROM "core"."admin_job"
			WHERE "name" = 'scheduled-jobs-log-cleanup'
		`,
		);
	}
}


