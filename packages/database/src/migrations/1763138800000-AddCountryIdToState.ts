import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add country_id foreign key to state table.
 * This allows states to be associated with a country (required).
 */
export class AddCountryIdToState1763138800000 implements MigrationInterface {
	name = 'AddCountryIdToState1763138800000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add country_id column (NOT NULL with default for existing rows)
		await queryRunner.query(`
			ALTER TABLE core.state
			ADD COLUMN country_id INTEGER NOT NULL DEFAULT 3
		`)

		// Remove default after adding column (default was only for existing rows)
		await queryRunner.query(`
			ALTER TABLE core.state
			ALTER COLUMN country_id DROP DEFAULT
		`)

		// Add foreign key constraint to country table
		await queryRunner.query(`
			ALTER TABLE core.state
			ADD CONSTRAINT fk_state_country
			FOREIGN KEY (country_id)
			REFERENCES core.country(id)
			ON DELETE RESTRICT
			ON UPDATE CASCADE
		`)

		// Create index for better query performance
		await queryRunner.query(`
			CREATE INDEX idx_state_country_id ON core.state(country_id)
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop index
		await queryRunner.query(`
			DROP INDEX IF EXISTS core.idx_state_country_id
		`)

		// Drop foreign key constraint
		await queryRunner.query(`
			ALTER TABLE core.state
			DROP CONSTRAINT IF EXISTS fk_state_country
		`)

		// Drop column
		await queryRunner.query(`
			ALTER TABLE core.state
			DROP COLUMN IF EXISTS country_id
		`)
	}
}
