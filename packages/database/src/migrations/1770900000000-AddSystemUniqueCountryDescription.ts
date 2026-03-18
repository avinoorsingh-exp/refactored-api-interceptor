import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds a unique constraint on (country_id, description) to the system table.
 * A system description must be unique within a country.
 *
 * Before creating the index, removes duplicate (country_id, description) rows,
 * keeping the one with the latest last_modified timestamp for each group.
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class AddSystemUniqueCountryDescription1770900000000 implements MigrationInterface {
	name = 'AddSystemUniqueCountryDescription1770900000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Delete duplicate systems, keeping the row with the latest last_modified per (country_id, description).
		// If timestamps tie, keep the highest id.
		const result = await queryRunner.query(`
			DELETE FROM "core"."system" s
			USING (
				SELECT "country_id", "description",
					(ARRAY_AGG("id" ORDER BY "last_modified" DESC, "id" DESC))[1] AS keep_id
				FROM "core"."system"
				GROUP BY "country_id", "description"
				HAVING COUNT(*) > 1
			) dups
			WHERE s."country_id" = dups."country_id"
			AND s."description" = dups."description"
			AND s."id" != dups.keep_id
		`)

		if (result?.[1] > 0) {
			console.log(`[Migration] Removed ${result[1]} duplicate system rows before adding unique constraint`)
		}

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "uq_system_country_description"
			ON "core"."system" ("country_id", "description")
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."uq_system_country_description"
		`)
	}
}
