import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add agent_id foreign key to license table.
 *
 * This migration:
 * - Adds agent_id (UUID) column to core.license table
 * - Creates foreign key constraint to core.agent(id)
 * - Creates index on agent_id for query performance
 * - Adds unique constraint on (agent_id, number) to ensure license number uniqueness per agent
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class AddAgentIdToLicense1770300000000 implements MigrationInterface {
	name = 'AddAgentIdToLicense1770300000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if column already exists
		const columnExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'agent_id'
		`)

		if (columnExists.length > 0) {
			console.log('Column agent_id already exists on core.license, skipping migration')
			return
		}

		// Add the agent_id column (nullable initially to allow migration of existing data)
		await queryRunner.query(`
			ALTER TABLE "core"."license"
			ADD COLUMN "agent_id" uuid
		`)

		// Create foreign key constraint
		await queryRunner.query(`
			ALTER TABLE "core"."license"
			ADD CONSTRAINT "FK_license_agent"
			FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)

		// Create index for query performance
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_license_agent_id"
			ON "core"."license" ("agent_id")
		`)

		// Create unique constraint on (agent_id, number) for license number uniqueness per agent
		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "IDX_license_agent_number_unique"
			ON "core"."license" ("agent_id", "number")
			WHERE "agent_id" IS NOT NULL
		`)

		// Create partial unique index for primary license per agent (only one primary allowed)
		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "IDX_license_agent_primary_unique"
			ON "core"."license" ("agent_id")
			WHERE "is_primary" = true
		`)

		// Make agent_id NOT NULL (after constraints are in place)
		// Check if column is already NOT NULL before altering
		const columnInfo = await queryRunner.query(`
			SELECT is_nullable FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'agent_id'
		`)

		if (columnInfo.length > 0 && columnInfo[0].is_nullable === 'YES') {
			await queryRunner.query(`
				ALTER TABLE "core"."license"
				ALTER COLUMN "agent_id" SET NOT NULL
			`)
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Check if column exists before attempting to drop
		const columnExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'agent_id'
		`)

		if (columnExists.length === 0) {
			console.log('Column agent_id does not exist on core.license, skipping rollback')
			return
		}

		// Drop unique index
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_license_agent_number_unique"
		`)

		// Drop primary license unique index
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_license_agent_primary_unique"
		`)

		// Drop index
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_license_agent_id"
		`)

		// Drop foreign key constraint
		await queryRunner.query(`
			ALTER TABLE "core"."license"
			DROP CONSTRAINT IF EXISTS "FK_license_agent"
		`)

		// Drop the column
		await queryRunner.query(`
			ALTER TABLE "core"."license"
			DROP COLUMN "agent_id"
		`)
	}
}
