import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Drop actor column, add created_by column to core.note
 *
 * The actor field is replaced by created_by from FullAuditableEntity.
 * - Drops: actor (text, NOT NULL)
 * - Adds: created_by (text, NOT NULL, default 'system')
 */
export class NoteDropActorAddCreatedBy1771200000003 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add created_by column with default
		await queryRunner.query(`
			ALTER TABLE core.note
			ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'system'
		`)

		// Copy actor values into created_by for existing rows
		await queryRunner.query(`
			UPDATE core.note
			SET created_by = actor
			WHERE actor IS NOT NULL
		`)

		// Drop actor column
		await queryRunner.query(`
			ALTER TABLE core.note
			DROP COLUMN IF EXISTS actor
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restore actor column
		await queryRunner.query(`
			ALTER TABLE core.note
			ADD COLUMN IF NOT EXISTS actor text NOT NULL DEFAULT 'system'
		`)

		// Copy created_by values back to actor
		await queryRunner.query(`
			UPDATE core.note
			SET actor = created_by
			WHERE created_by IS NOT NULL
		`)

		// Drop created_by column
		await queryRunner.query(`
			ALTER TABLE core.note
			DROP COLUMN IF EXISTS created_by
		`)
	}
}
