import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Normalize lifecycle_status values to lowercase.
 *
 * Purpose:
 * - Normalizes existing lifecycle_status values in agent and office tables to lowercase
 * - Ensures consistency with schema validation that now expects lowercase values
 *
 * Changes:
 * - Updates agent.lifecycle_status: 'Joining' -> 'joining', 'Active' -> 'active', etc.
 * - Updates office.lifecycle_status: 'Active' -> 'active', 'New' -> 'new', etc.
 *
 * This migration is idempotent - running it multiple times has no effect if values are already lowercase.
 */
export class NormalizeLifecycleStatusToLowercase1765930000000 implements MigrationInterface {
	name = 'NormalizeLifecycleStatusToLowercase1765930000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Normalize agent lifecycle_status to lowercase
		await queryRunner.query(`
			UPDATE core.agent
			SET lifecycle_status = LOWER(lifecycle_status)
			WHERE lifecycle_status IS NOT NULL
			  AND lifecycle_status <> LOWER(lifecycle_status)
		`)

		// Normalize office lifecycle_status to lowercase
		await queryRunner.query(`
			UPDATE core.office
			SET lifecycle_status = LOWER(lifecycle_status)
			WHERE lifecycle_status IS NOT NULL
			  AND lifecycle_status <> LOWER(lifecycle_status)
		`)

		// Normalize MLS lifecycle_status to lowercase (if any mixed case values exist)
		await queryRunner.query(`
			UPDATE core.mls
			SET lifecycle_status = LOWER(lifecycle_status)
			WHERE lifecycle_status IS NOT NULL
			  AND lifecycle_status <> LOWER(lifecycle_status)
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Note: Rollback is intentionally left empty.
		// We cannot reliably restore the original case since we don't know what it was.
		// The lowercase values are valid and the application now expects them.
		console.log('Rollback for NormalizeLifecycleStatusToLowercase: No action taken.')
		console.log('Original case information was not preserved and cannot be restored.')
	}
}
