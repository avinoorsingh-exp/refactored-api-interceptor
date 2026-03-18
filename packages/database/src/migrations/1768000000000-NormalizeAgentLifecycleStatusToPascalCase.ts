import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Normalize agent lifecycle_status values to PascalCase.
 *
 * Purpose:
 * - Converts agent lifecycle_status values to PascalCase format to match migration data
 * - Handles both lowercase and space-separated formats
 *
 * Changes:
 * - 'joining' -> 'Joining'
 * - 'active' -> 'Active'
 * - 'inactive' -> 'InActive'
 * - 'vested' -> 'Vested'
 * - 'vested retired' -> 'VestedRetired'
 * - 'lead only' -> 'LeadOnly'
 *
 * This migration is idempotent - running it multiple times has no effect if values are already PascalCase.
 */
export class NormalizeAgentLifecycleStatusToPascalCase1768000000000 implements MigrationInterface {
	name = 'NormalizeAgentLifecycleStatusToPascalCase1768000000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Update agent lifecycle_status to PascalCase
		await queryRunner.query(`
			UPDATE core.agent
			SET lifecycle_status = CASE lifecycle_status
				WHEN 'joining' THEN 'Joining'
				WHEN 'active' THEN 'Active'
				WHEN 'inactive' THEN 'InActive'
				WHEN 'vested' THEN 'Vested'
				WHEN 'vested retired' THEN 'VestedRetired'
				WHEN 'lead only' THEN 'LeadOnly'
				ELSE lifecycle_status
			END
			WHERE lifecycle_status IN ('joining', 'active', 'inactive', 'vested', 'vested retired', 'lead only')
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Revert to lowercase format
		await queryRunner.query(`
			UPDATE core.agent
			SET lifecycle_status = CASE lifecycle_status
				WHEN 'Joining' THEN 'joining'
				WHEN 'Active' THEN 'active'
				WHEN 'InActive' THEN 'inactive'
				WHEN 'Vested' THEN 'vested'
				WHEN 'VestedRetired' THEN 'vested retired'
				WHEN 'LeadOnly' THEN 'lead only'
				ELSE lifecycle_status
			END
			WHERE lifecycle_status IN ('Joining', 'Active', 'InActive', 'Vested', 'VestedRetired', 'LeadOnly')
		`)
	}
}
