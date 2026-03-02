import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Enables the pg_trgm extension and adds GIN trigram indexes to support
 * ILIKE '%...%' search on contact_method.value and agent first/last name.
 *
 * Background: The agents list endpoint with `include=contactMethod&search=joh`
 * was doing sequential scans on contact_method.value with ILIKE. Trigram GIN
 * indexes allow PostgreSQL to use index scans for leading-wildcard ILIKE.
 *
 * Also adds a covering index on contact_method(agent_id, value) to support
 * the EXISTS subquery path used when contactMethod is not included.
 */
export class EnablePgTrgmAndContactMethodSearchIndexes1771600000000 implements MigrationInterface {
	name = 'EnablePgTrgmAndContactMethodSearchIndexes1771600000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Enable pg_trgm extension (idempotent)
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)

		// GIN trigram index on contact_method.value for ILIKE '%search%' queries
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_contact_method_value_trgm"
			ON "core"."contact_method" USING GIN ("value" gin_trgm_ops)
		`)

		// Btree index on contact_method(agent_id, value) for the EXISTS subquery:
		//   EXISTS (SELECT 1 FROM core.contact_method WHERE agent_id = ... AND value ILIKE ...)
		// agent_id enables index lookup; value is included for filter pushdown.
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_contact_method_agent_id_value"
			ON "core"."contact_method" ("agent_id", "value")
		`)

		// GIN trigram indexes on agent first_name / last_name for ILIKE strategy search
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_first_name_trgm"
			ON "core"."agent" USING GIN ("first_name" gin_trgm_ops)
		`)

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_last_name_trgm"
			ON "core"."agent" USING GIN ("last_name" gin_trgm_ops)
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_last_name_trgm"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_first_name_trgm"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_contact_method_agent_id_value"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_contact_method_value_trgm"`)
		// Note: not dropping pg_trgm extension as other code may depend on it
	}
}
