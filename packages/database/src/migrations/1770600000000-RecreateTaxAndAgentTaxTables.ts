import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Recreates the tax table with new schema for storing agent tax identifiers,
 * and creates the agent_tax junction table for agent-to-tax relationships.
 *
 * Tax table stores:
 * - tax_id_type: Enum (SSN, GSN_HST, EIN)
 * - value: Encrypted tax ID value (AES-256-GCM)
 * - value_hashed: Hashed value for secure lookups
 *
 * Agent_tax junction table links agents to their tax records with is_primary flag.
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class RecreateTaxAndAgentTaxTables1770600000000 implements MigrationInterface {
	name = 'RecreateTaxAndAgentTaxTables1770600000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// =========================================
		// Step 1: Drop existing tax table if it exists
		// =========================================
		const taxTableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'tax'
		`)

		if (taxTableExists.length > 0) {
			// Drop any existing foreign keys first
			await queryRunner.query(`
				DO $$
				BEGIN
					IF EXISTS (
						SELECT 1 FROM information_schema.table_constraints
						WHERE constraint_name = 'FK_agent_tax_tax'
						AND table_schema = 'core'
					) THEN
						ALTER TABLE "core"."agent_tax" DROP CONSTRAINT "FK_agent_tax_tax";
					END IF;
				END $$;
			`)

			await queryRunner.query(`DROP TABLE IF EXISTS "core"."tax" CASCADE`)
		}

		// =========================================
		// Step 2: Create new tax table
		// =========================================
		await queryRunner.query(`
			CREATE TABLE "core"."tax" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"tax_id_type" text NOT NULL,
				"value" text NOT NULL,
				"value_hashed" text,
				"created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"modified_by" text NOT NULL DEFAULT 'system',
				"mxid" bigint,
				CONSTRAINT "PK_tax" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_tax_id_type" CHECK ("tax_id_type" IN ('SSN', 'GSN_HST', 'EIN'))
			)
		`)

		// Add index on value_hashed for efficient lookups
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_tax_value_hashed"
			ON "core"."tax" ("value_hashed")
		`)

		// Add index on tax_id_type for filtering
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_tax_tax_id_type"
			ON "core"."tax" ("tax_id_type")
		`)

		// =========================================
		// Step 3: Create agent_tax junction table
		// =========================================
		const agentTaxTableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'agent_tax'
		`)

		if (agentTaxTableExists.length === 0) {
			await queryRunner.query(`
				CREATE TABLE "core"."agent_tax" (
					"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
					"agent_id" uuid NOT NULL,
					"tax_id" uuid NOT NULL,
					"is_primary" boolean NOT NULL DEFAULT false,
					CONSTRAINT "PK_agent_tax" PRIMARY KEY ("id")
				)
			`)

			// Add foreign key to agent
			await queryRunner.query(`
				ALTER TABLE "core"."agent_tax"
				ADD CONSTRAINT "FK_agent_tax_agent"
				FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id")
				ON DELETE CASCADE ON UPDATE NO ACTION
			`)

			// Add foreign key to tax
			await queryRunner.query(`
				ALTER TABLE "core"."agent_tax"
				ADD CONSTRAINT "FK_agent_tax_tax"
				FOREIGN KEY ("tax_id") REFERENCES "core"."tax"("id")
				ON DELETE CASCADE ON UPDATE NO ACTION
			`)

			// Add unique constraint to prevent duplicate agent-tax pairs
			await queryRunner.query(`
				ALTER TABLE "core"."agent_tax"
				ADD CONSTRAINT "UQ_agent_tax_agent_tax"
				UNIQUE ("agent_id", "tax_id")
			`)

			// Add index on agent_id for efficient lookups
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_agent_tax_agent_id"
				ON "core"."agent_tax" ("agent_id")
			`)

			// Add index on tax_id for efficient lookups
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_agent_tax_tax_id"
				ON "core"."agent_tax" ("tax_id")
			`)
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop agent_tax table first (has foreign key to tax)
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."agent_tax" CASCADE`)

		// Drop tax table
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."tax" CASCADE`)

		// Recreate original tax table structure (for rollback)
		await queryRunner.query(`
			CREATE TABLE "core"."tax" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"tax_id" text NOT NULL,
				"type" text NOT NULL,
				"jurisdiction" text NOT NULL,
				"rate" decimal(10,4),
				"effective_date" TIMESTAMP WITH TIME ZONE,
				"expiration_date" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_tax" PRIMARY KEY ("id")
			)
		`)
	}
}
