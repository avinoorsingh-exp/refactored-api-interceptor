import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add defaults to state table audit columns.
 * Aligns state table with region table pattern where audit fields have defaults:
 * - last_modified defaults to now()
 * - modified_by defaults to 'system'
 */
export class AddStateAuditDefaults1763138700000 implements MigrationInterface {
	name = 'AddStateAuditDefaults1763138700000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add default for last_modified (matches region table)
		await queryRunner.query(`
			ALTER TABLE core.state 
			ALTER COLUMN last_modified SET DEFAULT now()
		`)

		// Add default for modified_by (matches region table)
		await queryRunner.query(`
			ALTER TABLE core.state 
			ALTER COLUMN modified_by SET DEFAULT 'system'
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove defaults
		await queryRunner.query(`
			ALTER TABLE core.state 
			ALTER COLUMN last_modified DROP DEFAULT
		`)

		await queryRunner.query(`
			ALTER TABLE core.state 
			ALTER COLUMN modified_by DROP DEFAULT
		`)
	}
}
