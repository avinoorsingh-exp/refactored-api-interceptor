import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds audit columns to core.note table.
 *
 * The InitialSchema migration created note with only (id, actor, body, date).
 * The entity now extends AuditableEntity which requires:
 *   - created (timestamptz)
 *   - last_modified (timestamptz)
 *   - modified_by (text)
 *   - mxid (bigint, nullable)
 *
 * This migration is idempotent — safe to run multiple times.
 */
export class AddNoteAuditColumns1771200000000 implements MigrationInterface {
	name = 'AddNoteAuditColumns1771200000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add created column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'note'
					AND column_name = 'created'
				) THEN
					ALTER TABLE "core"."note"
						ADD COLUMN "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
				END IF;
			END $$;
		`)

		// Add last_modified column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'note'
					AND column_name = 'last_modified'
				) THEN
					ALTER TABLE "core"."note"
						ADD COLUMN "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
				END IF;
			END $$;
		`)

		// Add modified_by column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'note'
					AND column_name = 'modified_by'
				) THEN
					ALTER TABLE "core"."note"
						ADD COLUMN "modified_by" TEXT NOT NULL DEFAULT 'system';
				END IF;
			END $$;
		`)

		// Add mxid column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'note'
					AND column_name = 'mxid'
				) THEN
					ALTER TABLE "core"."note"
						ADD COLUMN "mxid" BIGINT;
				END IF;
			END $$;
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."note"
				DROP COLUMN IF EXISTS "mxid",
				DROP COLUMN IF EXISTS "modified_by",
				DROP COLUMN IF EXISTS "last_modified",
				DROP COLUMN IF EXISTS "created"
		`)
	}
}
