import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Make cron_expression nullable to support manual-only jobs.
 *
 * Purpose:
 * - Allow jobs to exist without a cron schedule (manual-only jobs)
 * - Jobs with null cron_expression can only be triggered manually
 * - Enables post-deployment scripts and one-off tasks to use the same system
 *
 * Changes:
 * - Makes cron_expression column nullable in admin_job table
 */
export class MakeCronExpressionNullable1769200000003 implements MigrationInterface {
	name = 'MakeCronExpressionNullable1769200000003';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job"
			ALTER COLUMN "cron_expression" DROP NOT NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Set default cron for any null values before making NOT NULL
		await queryRunner.query(`
			UPDATE "core"."admin_job"
			SET "cron_expression" = '0 0 * * *'
			WHERE "cron_expression" IS NULL
		`);
		
		await queryRunner.query(`
			ALTER TABLE "core"."admin_job"
			ALTER COLUMN "cron_expression" SET NOT NULL
		`);
	}
}

