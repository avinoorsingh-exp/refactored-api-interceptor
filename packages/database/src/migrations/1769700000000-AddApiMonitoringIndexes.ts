import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add performance indexes for API monitoring tables.
 *
 * Purpose:
 * - Optimize common query patterns for api_request_log, api_route_stats, and api_actor
 * - Improve performance for time-range queries with filters
 * - Support efficient GROUP BY operations for aggregations
 * - Enable fast cursor-based pagination
 *
 * Index Strategy:
 * - Composite indexes ordered by selectivity (most selective first)
 * - Include timestamp/date columns last in composite indexes (range queries)
 * - Cover common filter combinations used in dashboard queries
 */
export class AddApiMonitoringIndexes1769700000000 implements MigrationInterface {
	name = 'AddApiMonitoringIndexes1769700000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// api_request_log indexes
		// ============================================

		// Index for route breakdown queries with filters
		// Query pattern: WHERE timestamp BETWEEN ... AND route IN (...) AND method IN (...) AND statusCode IN (...)
		// GROUP BY route, method
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_api_request_log_timestamp_route_method_status"
			ON "core"."api_request_log" ("timestamp", "route", "method", "status_code")
		`);

		// Index for top callers aggregation
		// Query pattern: WHERE timestamp BETWEEN ... AND actor_id IS NOT NULL
		// GROUP BY actor_id, actor_type
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_api_request_log_timestamp_actor_type"
			ON "core"."api_request_log" ("timestamp", "actor_id", "actor_type")
		`);

		// Index for route breakdown aggregation (without status code filter)
		// Query pattern: WHERE timestamp BETWEEN ... AND route IN (...) AND method IN (...)
		// GROUP BY route, method
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_api_request_log_timestamp_route_method"
			ON "core"."api_request_log" ("timestamp", "route", "method")
		`);

		// Index for cursor-based pagination in error samples
		// Query pattern: WHERE hasError = true AND createdAt < ... ORDER BY createdAt DESC, id DESC
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_api_request_log_created_at_id"
			ON "core"."api_request_log" ("created_at" DESC, "id" DESC)
		`);

		// Index for error samples with classification filter
		// Query pattern: WHERE timestamp BETWEEN ... AND hasError = true AND errorClassification IN (...)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_api_request_log_timestamp_error_classification"
			ON "core"."api_request_log" ("timestamp", "has_error", "error_classification")
		`);

		// Index for actor activity queries
		// Query pattern: WHERE actorId = ... AND timestamp BETWEEN ... ORDER BY timestamp DESC
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_api_request_log_actor_timestamp_desc"
			ON "core"."api_request_log" ("actor_id", "timestamp" DESC)
		`);

		// ============================================
		// api_route_stats indexes
		// ============================================

		// Index for time-series queries with filters
		// Query pattern: WHERE bucket_start BETWEEN ... AND route IN (...) AND method IN (...) AND time_bucket = ...
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_api_route_stats_bucket_route_method_bucket"
			ON "core"."api_route_stats" ("bucket_start", "route", "method", "time_bucket")
		`);

		// ============================================
		// api_actor indexes
		// ============================================

		// Index for actor lookups by ID (for joins)
		// Note: Primary key already covers this, but explicit index helps with query planning
		// This is optional - PK index already exists, but keeping for completeness
		// await queryRunner.query(`
		// 	CREATE INDEX IF NOT EXISTS "idx_api_actor_id"
		// 	ON "core"."api_actor" ("id")
		// `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes in reverse order
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_api_route_stats_bucket_route_method_bucket"
		`);

		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_api_request_log_actor_timestamp_desc"
		`);

		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_api_request_log_timestamp_error_classification"
		`);

		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_api_request_log_created_at_id"
		`);

		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_api_request_log_timestamp_route_method"
		`);

		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_api_request_log_timestamp_actor_type"
		`);

		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_api_request_log_timestamp_route_method_status"
		`);
	}
}


