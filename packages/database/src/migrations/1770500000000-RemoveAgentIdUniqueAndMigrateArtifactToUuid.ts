import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to:
 * 1. Remove the unique constraint on agent.agent_id (UQ_agent_agent_id)
 * 2. Migrate artifact.agent_id from bigint (legacy ID) to UUID (primary key reference)
 *
 * The artifact table currently references agent.agent_id (bigint). This migration
 * changes it to reference agent.id (UUID) to align with the rest of the system.
 *
 * This migration is idempotent - it checks column types and constraint existence
 * before making changes.
 */
export class RemoveAgentIdUniqueAndMigrateArtifactToUuid1770500000000 implements MigrationInterface {
	name = 'RemoveAgentIdUniqueAndMigrateArtifactToUuid1770500000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// STEP 1: Migrate artifact.agent_id from bigint to UUID
		// (Must happen BEFORE dropping the unique constraint,
		// since the existing FK references agent.agent_id which
		// requires the unique constraint)
		// ============================================
		await this.migrateArtifactAgentId(queryRunner)

		// ============================================
		// STEP 2: Remove unique constraint on agent.agent_id
		// ============================================
		await this.removeAgentIdUniqueConstraint(queryRunner)
	}

	private async migrateArtifactAgentId(queryRunner: QueryRunner): Promise<void> {
		// Check if migration has already been applied (agent_id is already uuid type)
		const columnInfo = await queryRunner.query(`
			SELECT data_type FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'artifact'
			AND column_name = 'agent_id'
		`)

		// If agent_id is already uuid, migration was already applied
		if (columnInfo.length > 0 && columnInfo[0].data_type === 'uuid') {
			return
		}

		// If column doesn't exist, skip
		if (columnInfo.length === 0) {
			return
		}

		// Step 1: Drop the existing FK constraint on artifact.agent_id -> agent.agent_id
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			DROP CONSTRAINT IF EXISTS "FK_e19c0ef843d6873b96b4b1cf134"
		`)

		// Step 2: Add new UUID column
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			ADD COLUMN IF NOT EXISTS "agent_uuid" uuid
		`)

		// Step 3: Populate the new column by looking up agent.id from agent.agent_id
		await queryRunner.query(`
			UPDATE "core"."artifact" art
			SET "agent_uuid" = a."id"
			FROM "core"."agent" a
			WHERE art."agent_id"::text = a."agent_id"::text
		`)

		// Step 4: Delete orphaned records (where no matching agent was found)
		await queryRunner.query(`
			DELETE FROM "core"."artifact"
			WHERE "agent_uuid" IS NULL
		`)

		// Step 5: Drop the old bigint agent_id column
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			DROP COLUMN "agent_id"
		`)

		// Step 6: Rename agent_uuid to agent_id
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			RENAME COLUMN "agent_uuid" TO "agent_id"
		`)

		// Step 7: Make the new column NOT NULL
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			ALTER COLUMN "agent_id" SET NOT NULL
		`)

		// Step 8: Add foreign key constraint to agent.id (UUID)
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			ADD CONSTRAINT "FK_artifact_agent"
			FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)

		// Step 9: Create index on agent_id for faster lookups
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_artifact_agent_id"
			ON "core"."artifact" ("agent_id")
		`)
	}

	private async removeAgentIdUniqueConstraint(queryRunner: QueryRunner): Promise<void> {
		// Check if the unique constraint exists before trying to drop it
		const constraintExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE table_schema = 'core'
			AND table_name = 'agent'
			AND constraint_name = 'UQ_agent_agent_id'
		`)

		if (constraintExists.length === 0) {
			return
		}

		await queryRunner.query(`
			ALTER TABLE "core"."agent"
			DROP CONSTRAINT "UQ_agent_agent_id"
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// STEP 1: Re-add unique constraint on agent.agent_id
		// (Must happen BEFORE reverting artifact, since the
		// old FK references agent.agent_id which requires uniqueness)
		// ============================================
		await this.restoreAgentIdUniqueConstraint(queryRunner)

		// ============================================
		// STEP 2: Revert artifact.agent_id from UUID back to bigint
		// ============================================
		await this.revertArtifactAgentId(queryRunner)
	}

	private async restoreAgentIdUniqueConstraint(queryRunner: QueryRunner): Promise<void> {
		const constraintExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE table_schema = 'core'
			AND table_name = 'agent'
			AND constraint_name = 'UQ_agent_agent_id'
		`)

		if (constraintExists.length > 0) {
			return
		}

		await queryRunner.query(`
			ALTER TABLE "core"."agent"
			ADD CONSTRAINT "UQ_agent_agent_id" UNIQUE ("agent_id")
		`)
	}

	private async revertArtifactAgentId(queryRunner: QueryRunner): Promise<void> {
		// Check if we need to revert (agent_id should be uuid)
		const columnInfo = await queryRunner.query(`
			SELECT data_type FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'artifact'
			AND column_name = 'agent_id'
		`)

		// If agent_id is not uuid, nothing to revert
		if (columnInfo.length === 0 || columnInfo[0].data_type !== 'uuid') {
			return
		}

		// Drop the index
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_artifact_agent_id"`)

		// Drop foreign key constraint
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			DROP CONSTRAINT IF EXISTS "FK_artifact_agent"
		`)

		// Rename agent_id to agent_uuid temporarily
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			RENAME COLUMN "agent_id" TO "agent_uuid"
		`)

		// Add back the bigint agent_id column
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			ADD COLUMN "agent_id" bigint
		`)

		// Populate from agent.agent_id
		await queryRunner.query(`
			UPDATE "core"."artifact" art
			SET "agent_id" = a."agent_id"
			FROM "core"."agent" a
			WHERE art."agent_uuid" = a."id"
		`)

		// Make NOT NULL
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			ALTER COLUMN "agent_id" SET NOT NULL
		`)

		// Drop the UUID column
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			DROP COLUMN "agent_uuid"
		`)

		// Restore the original FK constraint to agent.agent_id (bigint)
		await queryRunner.query(`
			ALTER TABLE "core"."artifact"
			ADD CONSTRAINT "FK_e19c0ef843d6873b96b4b1cf134"
			FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("agent_id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`)
	}
}
