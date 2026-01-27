import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed API Route Stats Aggregation job.
 *
 * Purpose:
 * - Insert admin job definition for API route stats aggregation
 * - Runs every hour at :05 to aggregate previous hour's request logs
 * - Enables fast dashboard queries without scanning raw logs
 *
 * Note: This migration is idempotent - it uses ON CONFLICT DO NOTHING.
 */
export class SeedApiRouteStatsAggregationJob1769600000000 implements MigrationInterface {
	name = 'SeedApiRouteStatsAggregationJob1769600000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Insert API Route Stats Aggregation Job
		await queryRunner.query(
			`
			INSERT INTO "core"."admin_job" ("name", "description", "cron_expression", "enabled", "run_count", "failure_count", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, 0, 0, NOW(), NOW())
			ON CONFLICT ("name") DO NOTHING
		`,
			[
				'api-route-stats-aggregation',
				'Aggregates API request logs into route statistics for fast dashboard queries (hourly buckets)',
				'0 5 * * * *', // Every hour at :05 (5 minutes past the hour)
			],
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove seeded job
		await queryRunner.query(
			`
			DELETE FROM "core"."admin_job"
			WHERE "name" = 'api-route-stats-aggregation'
		`,
		);
	}
}

