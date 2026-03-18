import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add log column to admin_job_execution table.
 *
 * Purpose:
 * - Store execution logs/output for job executions
 * - Allows UI to display what the job did during execution
 * - Supports both JSON and plain text log formats
 *
 * Changes:
 * - Adds "log" text column (nullable) to admin_job_execution table
 */
export class AddLogToAdminJobExecution1769200000002 implements MigrationInterface {
	name = 'AddLogToAdminJobExecution1769200000002';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job_execution"
			ADD COLUMN "log" text
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job_execution"
			DROP COLUMN IF EXISTS "log"
		`);
	}
}

