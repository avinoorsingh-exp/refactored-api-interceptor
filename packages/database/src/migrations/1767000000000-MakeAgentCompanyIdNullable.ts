import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to make agent_company_id nullable for legacy data migration.
 *
 * Changes:
 * CORE.AGENT:
 * 1. Make agent_company_id column nullable
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class MakeAgentCompanyIdNullable1767000000000 implements MigrationInterface {
	name = 'MakeAgentCompanyIdNullable1767000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// CORE.AGENT changes
		// ============================================

		// 1. Make agent_company_id column nullable
		const agentCompanyIdColumn = await queryRunner.query(`
			SELECT is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent'
			  AND column_name = 'agent_company_id'
		`);

		if (agentCompanyIdColumn.length > 0 && agentCompanyIdColumn[0].is_nullable === 'NO') {
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				ALTER COLUMN "agent_company_id" DROP NOT NULL
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// CORE.AGENT rollback
		// ============================================

		// 1. Make agent_company_id NOT NULL (only if no nulls exist)
		const nullAgentCompanyId = await queryRunner.query(`
			SELECT 1 FROM "core"."agent" WHERE "agent_company_id" IS NULL LIMIT 1
		`);

		if (nullAgentCompanyId.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				ALTER COLUMN "agent_company_id" SET NOT NULL
			`);
		}
	}
}
