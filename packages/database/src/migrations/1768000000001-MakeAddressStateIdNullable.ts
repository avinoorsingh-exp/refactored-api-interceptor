import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Make address.state_id nullable.
 *
 * Purpose:
 * - Allows addresses without a state (e.g., international addresses)
 * - Supports migration data that may have null state references
 *
 * Changes:
 * - Alters core.address.state_id column to allow NULL values
 * - Drops NOT NULL constraint on the foreign key
 */
export class MakeAddressStateIdNullable1768000000001 implements MigrationInterface {
	name = 'MakeAddressStateIdNullable1768000000001'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Alter state_id column to allow NULL values
		await queryRunner.query(`
			ALTER TABLE core.address
			ALTER COLUMN state_id DROP NOT NULL
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Note: Reverting this requires handling existing NULL values first
		// Set any NULL state_ids to a default value or delete those rows
		// For safety, we just restore the NOT NULL constraint
		// This will fail if there are NULL values in the column
		await queryRunner.query(`
			ALTER TABLE core.address
			ALTER COLUMN state_id SET NOT NULL
		`)
	}
}
