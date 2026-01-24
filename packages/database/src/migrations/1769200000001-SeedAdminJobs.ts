import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed initial admin job definitions.
 *
 * Purpose:
 * - Insert initial admin job definitions for scheduled jobs
 * - These jobs will be managed by AdminJobService
 * - Jobs can be enabled/disabled via the database without code changes
 *
 * Note: This migration is idempotent - it uses ON CONFLICT DO NOTHING.
 */
export class SeedAdminJobs1769200000001 implements MigrationInterface {
	name = 'SeedAdminJobs1769200000001';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Insert Kafka Message Cleanup Job
		await queryRunner.query(
			`
			INSERT INTO "core"."admin_job" ("name", "description", "cron_expression", "enabled", "run_count", "failure_count", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, 0, 0, NOW(), NOW())
			ON CONFLICT ("name") DO NOTHING
		`,
			[
				'kafka-message-cleanup',
				'Cleans up old Kafka message processing records older than retention period',
				'0 2 * * *', // Daily at 2 AM
			],
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove seeded jobs
		await queryRunner.query(
			`
			DELETE FROM "core"."admin_job"
			WHERE "name" = 'kafka-message-cleanup'
		`,
		);
	}
}

