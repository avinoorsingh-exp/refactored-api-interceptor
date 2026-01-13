import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to make state_id NOT NULL on address table.
 *
 * Changes:
 * CORE.ADDRESS:
 * 1. Delete addresses with NULL state_id (and cascade to agent_address junction)
 * 2. Make state_id column NOT NULL
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class MakeAddressStateIdNotNull1767200000000 implements MigrationInterface {
	name = 'MakeAddressStateIdNotNull1767200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// CORE.ADDRESS changes
		// ============================================

		// 1. Delete agent_address records that reference addresses with null state_id
		// Must delete junction records first due to foreign key constraint
		const deletedJunctionCount = await queryRunner.query(`
			DELETE FROM "core"."agent_address"
			WHERE "address_id" IN (
				SELECT "id" FROM "core"."address" WHERE "state_id" IS NULL
			)
		`);
		console.log(`Deleted ${deletedJunctionCount?.rowCount ?? 0} agent_address records with null state_id`);

		// 2. Delete addresses with null state_id
		const deletedAddressCount = await queryRunner.query(`
			DELETE FROM "core"."address" WHERE "state_id" IS NULL
		`);
		console.log(`Deleted ${deletedAddressCount?.rowCount ?? 0} address records with null state_id`);

		// 3. Make state_id NOT NULL (idempotent check)
		const stateIdColumn = await queryRunner.query(`
			SELECT is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'address'
			  AND column_name = 'state_id'
		`);

		if (stateIdColumn.length > 0 && stateIdColumn[0].is_nullable === 'YES') {
			await queryRunner.query(`
				ALTER TABLE "core"."address"
				ALTER COLUMN "state_id" SET NOT NULL
			`);
			console.log('Made state_id NOT NULL on address table');
		} else {
			console.log('state_id is already NOT NULL on address table');
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// ============================================
		// CORE.ADDRESS rollback
		// ============================================

		// 1. Make state_id nullable again
		const stateIdColumn = await queryRunner.query(`
			SELECT is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'address'
			  AND column_name = 'state_id'
		`);

		if (stateIdColumn.length > 0 && stateIdColumn[0].is_nullable === 'NO') {
			await queryRunner.query(`
				ALTER TABLE "core"."address"
				ALTER COLUMN "state_id" DROP NOT NULL
			`);
			console.log('Made state_id nullable on address table');
		}

		// Note: Deleted addresses cannot be restored in rollback
		console.log('Warning: Deleted addresses with null state_id cannot be restored');
	}
}
