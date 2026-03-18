import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create admin_job and admin_job_execution tables.
 *
 * Purpose:
 * - Store scheduled job metadata and configuration
 * - Track job execution history with status, duration, and errors
 * - Enable admin controls for pausing, resuming, and manually triggering jobs
 *
 * Changes:
 * - Creates core.admin_job table for job metadata
 * - Creates core.admin_job_execution table for execution history
 * - Adds indexes for common query patterns
 * - Creates enum type for execution status
 */
export class CreateAdminJobTables1769200000000 implements MigrationInterface {
	name = 'CreateAdminJobTables1769200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create enum type for execution status
		await queryRunner.query(`
			CREATE TYPE core.admin_job_execution_status AS ENUM ('RUNNING', 'SUCCESS', 'FAILED')
		`);

		// Create the admin_job table
		await queryRunner.query(`
			CREATE TABLE "core"."admin_job" (
				"name" text NOT NULL,
				"description" text NOT NULL,
				"cron_expression" text NOT NULL,
				"enabled" boolean NOT NULL DEFAULT true,
				"last_run_at" TIMESTAMP WITH TIME ZONE,
				"next_run_at" TIMESTAMP WITH TIME ZONE,
				"run_count" integer NOT NULL DEFAULT 0,
				"failure_count" integer NOT NULL DEFAULT 0,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_admin_job" PRIMARY KEY ("name")
			)
		`);

		// Create the admin_job_execution table
		await queryRunner.query(`
			CREATE TABLE "core"."admin_job_execution" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"job_name" text NOT NULL,
				"status" core.admin_job_execution_status NOT NULL,
				"started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
				"finished_at" TIMESTAMP WITH TIME ZONE,
				"duration_ms" integer,
				"error" text,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_admin_job_execution" PRIMARY KEY ("id"),
				CONSTRAINT "FK_admin_job_execution_job_name" FOREIGN KEY ("job_name") 
					REFERENCES "core"."admin_job"("name") ON DELETE CASCADE
			)
		`);

		// Create indexes for common query patterns
		await queryRunner.query(`
			CREATE INDEX "idx_admin_job_execution_job_name" 
			ON "core"."admin_job_execution" ("job_name")
		`);

		await queryRunner.query(`
			CREATE INDEX "idx_admin_job_execution_status" 
			ON "core"."admin_job_execution" ("status")
		`);

		await queryRunner.query(`
			CREATE INDEX "idx_admin_job_execution_started_at" 
			ON "core"."admin_job_execution" ("started_at")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_admin_job_execution_started_at"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_admin_job_execution_status"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_admin_job_execution_job_name"
		`);

		// Drop tables
		await queryRunner.query(`
			DROP TABLE IF EXISTS "core"."admin_job_execution"
		`);
		await queryRunner.query(`
			DROP TABLE IF EXISTS "core"."admin_job"
		`);

		// Drop enum type
		await queryRunner.query(`
			DROP TYPE IF EXISTS core.admin_job_execution_status
		`);
	}
}

