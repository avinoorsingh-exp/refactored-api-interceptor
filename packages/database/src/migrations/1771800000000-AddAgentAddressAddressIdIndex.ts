import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds index on agent_address.address_id for country filter performance.
 *
 * The composite PK (agent_id, address_id) only supports lookups by agent_id
 * (leading column). Without a standalone index on address_id, PostgreSQL cannot
 * reverse the join direction for country-based EXISTS subqueries, forcing
 * 82K random I/O lookups on the address table (~8ms each over network to RDS).
 *
 * With this index the planner can use: country → address (via idx_address_country_state)
 * → agent_address (via this index) → agent, which is orders of magnitude faster.
 *
 * Note: a standalone idx_address_country_id is NOT needed because the existing
 * composite idx_address_country_state(country_id, state_code) already covers
 * country_id-only lookups as its leading column.
 */
export class AddAgentAddressAddressIdIndex1771800000000 implements MigrationInterface {
	name = 'AddAgentAddressAddressIdIndex1771800000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_address_address_id"
			ON "core"."agent_address" ("address_id")
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_address_address_id"`)
	}
}
