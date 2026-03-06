import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds a GIN trigram index on agent.preferred_name to support
 * ILIKE '%...%' search. The pg_trgm extension is already enabled
 * by migration 1771600000000; first_name and last_name already
 * have equivalent indexes.
 */
export class AddPreferredNameTrgmIndex1771700000000 implements MigrationInterface {
	name = 'AddPreferredNameTrgmIndex1771700000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_preferred_name_trgm"
			ON "core"."agent" USING GIN ("preferred_name" gin_trgm_ops)
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_preferred_name_trgm"`)
	}
}
