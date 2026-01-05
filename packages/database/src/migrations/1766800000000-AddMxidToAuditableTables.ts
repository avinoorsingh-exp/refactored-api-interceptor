import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add mxid column to all tables that extend AuditableEntity.
 *
 * The mxid column is a nullable bigint used for storing legacy database IDs
 * during data migration from the legacy system.
 *
 * Affected tables:
 * - agent, social, contact_method, public_profile, license, country,
 *   artifact, program, office, mls, address, region, email_forward,
 *   pay_plan, agent_company, company, w9
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class AddMxidToAuditableTables1766800000000 implements MigrationInterface {
	name = 'AddMxidToAuditableTables1766800000000';

	// All tables that extend AuditableEntity
	private readonly tables = [
		'agent',
		'social',
		'contact_method',
		'public_profile',
		'license',
		'country',
		'artifact',
		'program',
		'office',
		'mls',
		'address',
		'region',
		'email_forward',
		'pay_plan',
		'agent_company',
		'company',
		'w9',
	];

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
