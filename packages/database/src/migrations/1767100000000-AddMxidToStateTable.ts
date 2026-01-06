import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add mxid column to tables that were missed in the original
 * AddMxidToAuditableTables migration.
 *
 * The mxid column is a nullable bigint used for storing legacy database IDs
 * during data migration from the legacy system.
 *
 * Affected tables:
 * - state: Extends SearchableAuditableEntity, was accidentally omitted
 * - agent_address: Junction table for Agent-Address many-to-many relationship
 * - agent_mls: Junction table for Agent-MLS many-to-many relationship
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class AddMxidToStateTable1767100000000 implements MigrationInterface {
	name = 'AddMxidToStateTable1767100000000';

	private readonly tables = ['state', 'agent_address', 'agent_mls'];

	public async up(queryRunner: QueryRunner): Promise<void> {
		for (const table of this.tables) {
			// Check if column already exists
			const columnExists = await queryRunner.query(`
				SELECT column_name
				FROM information_schema.columns
				WHERE table_schema = 'core'
				  AND table_name = '${table}'
				  AND column_name = 'mxid'
			`);

			if (columnExists.length === 0) {
				await queryRunner.query(`
					ALTER TABLE "core"."${table}"
					ADD COLUMN "mxid" bigint NULL
				`);
			}
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		for (const table of this.tables) {
			// Check if column exists before dropping
			const columnExists = await queryRunner.query(`
				SELECT column_name
				FROM information_schema.columns
				WHERE table_schema = 'core'
				  AND table_name = '${table}'
				  AND column_name = 'mxid'
			`);

			if (columnExists.length > 0) {
				await queryRunner.query(`
					ALTER TABLE "core"."${table}"
					DROP COLUMN "mxid"
				`);
			}
		}
	}
}
