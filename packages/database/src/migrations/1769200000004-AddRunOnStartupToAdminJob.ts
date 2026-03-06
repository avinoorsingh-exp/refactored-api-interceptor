import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add run_on_startup column to admin_job table.
 *
 * Purpose:
 * - Allow manual jobs to be configured to run once automatically on app startup
 * - Only applies to manual jobs (cron = null)
 * - After first successful execution, won't run again on subsequent startups
 *
 * Changes:
 * - Adds run_on_startup boolean column to admin_job table
 * - Defaults to false (jobs don't run on startup by default)
 */
export class AddRunOnStartupToAdminJob1769200000004 implements MigrationInterface {
	name = 'AddRunOnStartupToAdminJob1769200000004';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job"
			ADD COLUMN "run_on_startup" boolean NOT NULL DEFAULT false
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job"
			DROP COLUMN IF EXISTS "run_on_startup"
		`);
	}
}

