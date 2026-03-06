import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to relax constraints for legacy data migration.
 *
 * Changes:
 * CORE.COMPANY:
 * 1. Make email column nullable
 * 2. Remove unique constraint on email
 *
 * CORE.OFFICE:
 * 1. Make phone column nullable
 * 2. Make primary_state column nullable
 *
 * CORE.PAY_PLAN:
 * 1. Change agent_percentage to decimal(18,8)
 * 2. Change cap to decimal(18,8)
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class RelaxConstraintsForLegacyMigration1766900000000 implements MigrationInterface {
	name = 'RelaxConstraintsForLegacyMigration1766900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// CORE.COMPANY changes
		// ============================================

		// 1. Drop unique constraint on email if it exists
		const emailUniqueConstraint = await queryRunner.query(`
			SELECT constraint_name
			FROM information_schema.table_constraints
			WHERE table_schema = 'core'
			  AND table_name = 'company'
			  AND constraint_type = 'UNIQUE'
			  AND constraint_name LIKE '%email%'
		`);

		for (const row of emailUniqueConstraint) {
			await queryRunner.query(`
				ALTER TABLE "core"."company"
				DROP CONSTRAINT IF EXISTS "${row.constraint_name}"
			`);
		}

		// Also check for the auto-generated constraint name pattern
		await queryRunner.query(`
			ALTER TABLE "core"."company"
			DROP CONSTRAINT IF EXISTS "UQ_b0fc567cf51b1cf717a9e8046a1"
		`);

		// 2. Make email column nullable
		const companyEmailColumn = await queryRunner.query(`
			SELECT is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'company'
			  AND column_name = 'email'
		`);

		if (companyEmailColumn.length > 0 && companyEmailColumn[0].is_nullable === 'NO') {
			await queryRunner.query(`
				ALTER TABLE "core"."company"
				ALTER COLUMN "email" DROP NOT NULL
			`);
		}

		// ============================================
		// CORE.OFFICE changes
		// ============================================

		// 1. Make phone column nullable
		const officePhoneColumn = await queryRunner.query(`
			SELECT is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'office'
			  AND column_name = 'phone'
		`);

		if (officePhoneColumn.length > 0 && officePhoneColumn[0].is_nullable === 'NO') {
			await queryRunner.query(`
				ALTER TABLE "core"."office"
				ALTER COLUMN "phone" DROP NOT NULL
			`);
		}

		// 2. Make primary_state column nullable
		const officePrimaryStateColumn = await queryRunner.query(`
			SELECT is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'office'
			  AND column_name = 'primary_state'
		`);

		if (officePrimaryStateColumn.length > 0 && officePrimaryStateColumn[0].is_nullable === 'NO') {
			await queryRunner.query(`
				ALTER TABLE "core"."office"
				ALTER COLUMN "primary_state" DROP NOT NULL
			`);
		}

		// ============================================
		// CORE.PAY_PLAN changes
		// ============================================

		// 1. Change agent_percentage to decimal(18,8)
		const agentPercentageColumn = await queryRunner.query(`
			SELECT numeric_precision, numeric_scale
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'pay_plan'
			  AND column_name = 'agent_percentage'
		`);

		if (agentPercentageColumn.length > 0 &&
			(agentPercentageColumn[0].numeric_precision !== 18 || agentPercentageColumn[0].numeric_scale !== 8)) {
			await queryRunner.query(`
				ALTER TABLE "core"."pay_plan"
				ALTER COLUMN "agent_percentage" TYPE decimal(18,8)
			`);
		}

		// 2. Change cap to decimal(18,8)
		const capColumn = await queryRunner.query(`
			SELECT numeric_precision, numeric_scale
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'pay_plan'
			  AND column_name = 'cap'
		`);

		if (capColumn.length > 0 &&
			(capColumn[0].numeric_precision !== 18 || capColumn[0].numeric_scale !== 8)) {
			await queryRunner.query(`
				ALTER TABLE "core"."pay_plan"
				ALTER COLUMN "cap" TYPE decimal(18,8)
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// CORE.PAY_PLAN rollback
		// ============================================

		// 1. Revert cap to decimal(10,2) - original precision
		const capColumn = await queryRunner.query(`
			SELECT numeric_precision, numeric_scale
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'pay_plan'
			  AND column_name = 'cap'
		`);

		if (capColumn.length > 0 &&
			(capColumn[0].numeric_precision !== 10 || capColumn[0].numeric_scale !== 2)) {
			// Note: This may fail if existing data exceeds decimal(10,2) range
			await queryRunner.query(`
				ALTER TABLE "core"."pay_plan"
				ALTER COLUMN "cap" TYPE decimal(10,2)
			`);
		}

		// 2. Revert agent_percentage to decimal(5,2)
		const agentPercentageColumn = await queryRunner.query(`
			SELECT numeric_precision, numeric_scale
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'pay_plan'
			  AND column_name = 'agent_percentage'
		`);

		if (agentPercentageColumn.length > 0 &&
			(agentPercentageColumn[0].numeric_precision !== 5 || agentPercentageColumn[0].numeric_scale !== 2)) {
			await queryRunner.query(`
				ALTER TABLE "core"."pay_plan"
				ALTER COLUMN "agent_percentage" TYPE decimal(5,2)
			`);
		}

		// ============================================
		// CORE.OFFICE rollback
		// ============================================

		// Note: Cannot restore NOT NULL if null values exist
		// These are best-effort rollbacks

		// 1. Make primary_state NOT NULL (only if no nulls exist)
		const nullPrimaryState = await queryRunner.query(`
			SELECT 1 FROM "core"."office" WHERE "primary_state" IS NULL LIMIT 1
		`);

		if (nullPrimaryState.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."office"
				ALTER COLUMN "primary_state" SET NOT NULL
			`);
		}

		// 2. Make phone NOT NULL (only if no nulls exist)
		const nullPhone = await queryRunner.query(`
			SELECT 1 FROM "core"."office" WHERE "phone" IS NULL LIMIT 1
		`);

		if (nullPhone.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."office"
				ALTER COLUMN "phone" SET NOT NULL
			`);
		}

		// ============================================
		// CORE.COMPANY rollback
		// ============================================

		// 1. Make email NOT NULL (only if no nulls exist)
		const nullEmail = await queryRunner.query(`
			SELECT 1 FROM "core"."company" WHERE "email" IS NULL LIMIT 1
		`);

		if (nullEmail.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."company"
				ALTER COLUMN "email" SET NOT NULL
			`);

			// 2. Re-add unique constraint
			await queryRunner.query(`
				ALTER TABLE "core"."company"
				ADD CONSTRAINT "UQ_company_email" UNIQUE ("email")
			`);
		}
	}
}
