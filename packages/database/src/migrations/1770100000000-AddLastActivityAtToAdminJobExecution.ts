import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add last_activity_at column to admin_job_execution table.
 *
 * Purpose:
 * - Track execution activity for orphaned execution detection
 * - Optional field (nullable) to remain non-breaking for existing records
 * - Used by startup reconciliation to identify executions that were running during server restart
 *
 * Changes:
 * - Adds last_activity_at column to core.admin_job_execution table
 * - Column is nullable to support existing records
 * - No default value (updated during execution activity)
 */
export class AddLastActivityAtToAdminJobExecution1770100000000 implements MigrationInterface {
	name = 'AddLastActivityAtToAdminJobExecution1770100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add last_activity_at column (nullable, optional)
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job_execution"
			ADD COLUMN "last_activity_at" TIMESTAMP WITH TIME ZONE
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove last_activity_at column
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job_execution"
			DROP COLUMN IF EXISTS "last_activity_at"
		`);
	}
}

