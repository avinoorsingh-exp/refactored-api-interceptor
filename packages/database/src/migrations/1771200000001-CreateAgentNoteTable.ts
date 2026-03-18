import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Creates the agent_note junction table linking agents to notes.
 *
 * An agent can have multiple notes. Notes are created via
 * POST /v1/agents/:id/notes and linked through this junction table.
 *
 * This migration is idempotent — safe to run multiple times.
 */
export class CreateAgentNoteTable1771200000001 implements MigrationInterface {
	name = 'CreateAgentNoteTable1771200000001'

	public async up(queryRunner: QueryRunner): Promise<void> {
		const tableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'agent_note'
		`)

		if (tableExists.length === 0) {
			// Create agent_note junction table
			await queryRunner.query(`
				CREATE TABLE "core"."agent_note" (
					"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
					"agent_id" uuid NOT NULL,
					"note_id" uuid NOT NULL,
					CONSTRAINT "PK_agent_note" PRIMARY KEY ("id")
				)
			`)

			// Add foreign key to agent
			await queryRunner.query(`
				ALTER TABLE "core"."agent_note"
				ADD CONSTRAINT "FK_agent_note_agent"
				FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id")
				ON DELETE CASCADE ON UPDATE NO ACTION
			`)

			// Add foreign key to note
			await queryRunner.query(`
				ALTER TABLE "core"."agent_note"
				ADD CONSTRAINT "FK_agent_note_note"
				FOREIGN KEY ("note_id") REFERENCES "core"."note"("id")
				ON DELETE CASCADE ON UPDATE NO ACTION
			`)

			// Add unique constraint to prevent duplicate agent-note pairs
			await queryRunner.query(`
				ALTER TABLE "core"."agent_note"
				ADD CONSTRAINT "UQ_agent_note_agent_note"
				UNIQUE ("agent_id", "note_id")
			`)

			// Add index on agent_id for efficient lookups
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_agent_note_agent_id"
				ON "core"."agent_note" ("agent_id")
			`)

			// Add index on note_id for efficient lookups
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_agent_note_note_id"
				ON "core"."agent_note" ("note_id")
			`)
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."agent_note"
			DROP CONSTRAINT IF EXISTS "FK_agent_note_note"
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."agent_note"
			DROP CONSTRAINT IF EXISTS "FK_agent_note_agent"
		`)
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_agent_note_note_id"
		`)
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_agent_note_agent_id"
		`)
		await queryRunner.query(`
			DROP TABLE IF EXISTS "core"."agent_note"
		`)
	}
}
