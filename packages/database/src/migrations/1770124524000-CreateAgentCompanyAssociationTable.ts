import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Creates the agent_company_association junction table and migrates existing
 * agent.agent_company_id foreign key data to the junction table.
 *
 * This migration:
 * 1. Creates the new agent_company_association junction table
 * 2. Migrates existing agent -> agent_company relationships (with isPrimary = true)
 * 3. Drops the agent_company_id column from the agent table
 * 4. Adds encrypted tax_id columns to agent_company table
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class CreateAgentCompanyAssociationTable1770124524000 implements MigrationInterface {
	name = 'CreateAgentCompanyAssociationTable1770124524000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// =========================================
		// Step 1: Create agent_company_association table
		// =========================================
		const tableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'agent_company_association'
		`)

		if (tableExists.length === 0) {
			await queryRunner.query(`
				CREATE TABLE "core"."agent_company_association" (
					"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
					"agent_id" uuid NOT NULL,
					"agent_company_id" uuid NOT NULL,
					"is_primary" boolean NOT NULL DEFAULT false,
					CONSTRAINT "PK_agent_company_association" PRIMARY KEY ("id")
				)
			`)

			// Add foreign key to agent
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company_association"
				ADD CONSTRAINT "FK_agent_company_association_agent"
				FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id")
				ON DELETE CASCADE ON UPDATE NO ACTION
			`)

			// Add foreign key to agent_company
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company_association"
				ADD CONSTRAINT "FK_agent_company_association_agent_company"
				FOREIGN KEY ("agent_company_id") REFERENCES "core"."agent_company"("id")
				ON DELETE CASCADE ON UPDATE NO ACTION
			`)

			// Add unique constraint to prevent duplicate agent-company pairs
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company_association"
				ADD CONSTRAINT "UQ_agent_company_association_agent_company"
				UNIQUE ("agent_id", "agent_company_id")
			`)

			// Add index on agent_id for efficient lookups
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_agent_company_association_agent_id"
				ON "core"."agent_company_association" ("agent_id")
			`)

			// Add index on agent_company_id for efficient lookups
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_agent_company_association_agent_company_id"
				ON "core"."agent_company_association" ("agent_company_id")
			`)
		}

		// =========================================
		// Step 2: Migrate existing data from agent.agent_company_id
		// =========================================
		const agentCompanyIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'agent'
			AND column_name = 'agent_company_id'
		`)

		if (agentCompanyIdExists.length > 0) {
			// Migrate existing relationships to junction table (as primary)
			await queryRunner.query(`
				INSERT INTO "core"."agent_company_association" ("agent_id", "agent_company_id", "is_primary")
				SELECT "id", "agent_company_id", true
				FROM "core"."agent"
				WHERE "agent_company_id" IS NOT NULL
				ON CONFLICT ("agent_id", "agent_company_id") DO NOTHING
			`)

			// Drop the foreign key constraint first
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				DROP CONSTRAINT IF EXISTS "FK_agent_agent_company"
			`)
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				DROP CONSTRAINT IF EXISTS "FK_agent_agent_company_id"
			`)
			// Check for auto-generated constraint names
			const fkConstraints = await queryRunner.query(`
				SELECT constraint_name FROM information_schema.table_constraints
				WHERE table_schema = 'core'
				AND table_name = 'agent'
				AND constraint_type = 'FOREIGN KEY'
				AND constraint_name LIKE '%agent_company%'
			`)
			for (const fk of fkConstraints) {
				await queryRunner.query(`
					ALTER TABLE "core"."agent"
					DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"
				`)
			}

			// Drop the agent_company_id column
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				DROP COLUMN IF EXISTS "agent_company_id"
			`)
		}

		// =========================================
		// Step 3: Add encrypted tax_id columns to agent_company
		// =========================================
		const taxIdHashedExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'agent_company'
			AND column_name = 'tax_id_hashed'
		`)

		if (taxIdHashedExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ADD COLUMN IF NOT EXISTS "tax_id_hashed" text
			`)
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// =========================================
		// Step 1: Re-add agent_company_id column to agent
		// =========================================
		const agentCompanyIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'agent'
			AND column_name = 'agent_company_id'
		`)

		if (agentCompanyIdExists.length === 0) {
			// Add column back
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				ADD COLUMN "agent_company_id" uuid
			`)

			// Migrate primary association back to agent table
			await queryRunner.query(`
				UPDATE "core"."agent" a
				SET "agent_company_id" = aca."agent_company_id"
				FROM "core"."agent_company_association" aca
				WHERE a."id" = aca."agent_id"
				AND aca."is_primary" = true
			`)

			// Re-add foreign key constraint
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				ADD CONSTRAINT "FK_agent_agent_company"
				FOREIGN KEY ("agent_company_id") REFERENCES "core"."agent_company"("id")
				ON DELETE SET NULL ON UPDATE NO ACTION
			`)
		}

		// =========================================
		// Step 2: Drop tax_id_hashed column from agent_company
		// =========================================
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
			DROP COLUMN IF EXISTS "tax_id_hashed"
		`)

		// =========================================
		// Step 3: Drop agent_company_association table
		// =========================================
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company_association"
			DROP CONSTRAINT IF EXISTS "FK_agent_company_association_agent_company"
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company_association"
			DROP CONSTRAINT IF EXISTS "FK_agent_company_association_agent"
		`)
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_agent_company_association_agent_company_id"
		`)
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_agent_company_association_agent_id"
		`)
		await queryRunner.query(`
			DROP TABLE IF EXISTS "core"."agent_company_association"
		`)
	}
}
