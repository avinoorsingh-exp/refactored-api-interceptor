import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds missing indexes on foreign key columns used in JOIN operations.
 *
 * These tables were identified via load testing as causing sequential scans
 * when included via ?include= on the agents list endpoint.
 *
 * - agent_office: agent_id, office_id (no composite PK, UUID PK instead)
 * - public_profile: agent_id (one-to-one with agent, UUID PK instead)
 */
export class AddMissingForeignKeyIndexes1771500000000 implements MigrationInterface {
	name = 'AddMissingForeignKeyIndexes1771500000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_office_agent_id"
			ON "core"."agent_office" ("agent_id")
		`)

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_office_office_id"
			ON "core"."agent_office" ("office_id")
		`)

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_public_profile_agent_id"
			ON "core"."public_profile" ("agent_id")
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_public_profile_agent_id"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_office_office_id"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_office_agent_id"`)
	}
}
