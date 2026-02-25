import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Drops the redundant `date` column from core.note.
 *
 * The `date` column is superseded by the `created` audit field
 * added in AddNoteAuditColumns1771200000000.
 *
 * This migration is idempotent — safe to run multiple times.
 */
export class DropNoteDateColumn1771200000002 implements MigrationInterface {
	name = 'DropNoteDateColumn1771200000002'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."note"
			DROP COLUMN IF EXISTS "date"
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'note'
					AND column_name = 'date'
				) THEN
					ALTER TABLE "core"."note"
						ADD COLUMN "date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
				END IF;
			END $$;
		`)
	}
}
