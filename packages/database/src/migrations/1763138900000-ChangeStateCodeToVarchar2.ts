import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to change state.code column from text to varchar(2).
 * This enforces the 2-character state code constraint at the database level.
 */
export class ChangeStateCodeToVarchar21763138900000 implements MigrationInterface {
	name = 'ChangeStateCodeToVarchar21763138900000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// First, truncate any existing codes to 2 characters (safety measure)
		await queryRunner.query(`
			UPDATE core.state 
			SET code = LEFT(code, 2) 
			WHERE LENGTH(code) > 2
		`)

		// Change column type from text to varchar(2)
		await queryRunner.query(`
			ALTER TABLE core.state 
			ALTER COLUMN code TYPE varchar(2)
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Revert back to text type
		await queryRunner.query(`
			ALTER TABLE core.state 
			ALTER COLUMN code TYPE text
		`)
	}
}
