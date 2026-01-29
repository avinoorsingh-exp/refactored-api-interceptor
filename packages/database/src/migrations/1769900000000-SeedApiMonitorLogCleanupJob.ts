import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed API Monitor Log Cleanup job.
 *
 * Purpose:
 * - Insert admin job definition for API monitor log cleanup
 * - Runs daily at 3 AM UTC to clean up old request logs and anonymous actors
 * - Maintains storage efficiency while preserving attribution
 *
 * Retention Policy:
 * - api_request_log: 30 days (matches aggregation job's daily bucket backfill window)
 * - api_route_stats: 6 months (180 days) - aggregated stats retained for historical analysis
 * - Anonymous actors: 30 days (only if no references)
 * - Non-anonymous actors: NEVER deleted automatically
 * 
 * IMPORTANT: 30-day retention ensures logs are available for the full 30-day
 * daily bucket backfill period, preventing data loss if aggregation job fails.
 * Stats are retained longer (6 months) for trend analysis and reporting.
 *
 * Note: This migration is idempotent - it uses ON CONFLICT DO NOTHING.
 */
export class SeedApiMonitorLogCleanupJob1769900000000 implements MigrationInterface {
	name = 'SeedApiMonitorLogCleanupJob1769900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Insert API Monitor Log Cleanup Job
		await queryRunner.query(
			`
			INSERT INTO "core"."admin_job" ("name", "description", "cron_expression", "enabled", "run_count", "failure_count", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, 0, 0, NOW(), NOW())
			ON CONFLICT ("name") DO NOTHING
		`,
			[
				'api-monitor-log-cleanup',
				'Cleans up old API monitoring logs, stats, and anonymous actors (runs daily at 3 AM UTC). Retains 30 days of request logs, 6 months of aggregated stats, 30 days for anonymous actors.',
				'0 3 * * *', // Daily at 3 AM UTC
			],
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove seeded job
		await queryRunner.query(
			`
			DELETE FROM "core"."admin_job"
			WHERE "name" = 'api-monitor-log-cleanup'
		`,
		);
	}
}


