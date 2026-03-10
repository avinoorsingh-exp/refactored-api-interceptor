import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds indexes to improve /v1/agents list performance when using candidate set optimization.
 *
 * - core.agent(lifecycle_status): btree index so the candidate set subquery
 *   (WHERE lifecycle_status = :value ORDER BY id LIMIT N) uses an index instead of a full scan.
 * - core.country(name): GIN trigram index so country filter ILIKE/contains on name
 *   (when applied on the candidate set) can use an index. pg_trgm is already enabled.
 */
export class AddAgentLifecycleStatusAndCountryNameIndexes1771900000000 implements MigrationInterface {
	name = 'AddAgentLifecycleStatusAndCountryNameIndexes1771900000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_lifecycle_status"
			ON "core"."agent" ("lifecycle_status")
		`)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_country_name_trgm"
			ON "core"."country" USING GIN ("name" gin_trgm_ops)
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_country_name_trgm"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_lifecycle_status"`)
	}
}
