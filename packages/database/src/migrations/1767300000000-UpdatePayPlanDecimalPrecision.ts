import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to update pay_plan decimal precision for legacy data compatibility.
 * Changes agent_percentage and cap columns from DECIMAL(18,8) to DECIMAL(28,8).
 *
 * This is needed because legacy migration data may contain values that exceed
 * the 18-digit precision limit.
 */
export class UpdatePayPlanDecimalPrecision1767300000000 implements MigrationInterface {
	name = 'UpdatePayPlanDecimalPrecision1767300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Alter agent_percentage column to DECIMAL(28,8)
		await queryRunner.query(`
			ALTER TABLE "core"."pay_plan"
			ALTER COLUMN "agent_percentage" TYPE DECIMAL(28, 8)
		`);

		// Alter cap column to DECIMAL(28,8)
		await queryRunner.query(`
			ALTER TABLE "core"."pay_plan"
			ALTER COLUMN "cap" TYPE DECIMAL(28, 8)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Revert agent_percentage column to DECIMAL(18,8)
		await queryRunner.query(`
			ALTER TABLE "core"."pay_plan"
			ALTER COLUMN "agent_percentage" TYPE DECIMAL(18, 8)
		`);

		// Revert cap column to DECIMAL(18,8)
		await queryRunner.query(`
			ALTER TABLE "core"."pay_plan"
			ALTER COLUMN "cap" TYPE DECIMAL(18, 8)
		`);
	}
}
