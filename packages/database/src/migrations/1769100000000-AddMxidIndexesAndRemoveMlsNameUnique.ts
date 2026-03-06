import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add indexes on mxid column for all tables that have it,
 * and remove the unique constraint on mls.name.
 *
 * The mxid indexes improve query performance during data migrations from
 * the legacy system, where lookups by mxid are frequent.
 *
 * The mls.name unique constraint is being removed to allow duplicate MLS names
 * during the migration process.
 *
 * Affected tables for mxid index:
 * - agent, social, contact_method, public_profile, license, country,
 *   artifact, program, office, mls, address, region, email_forward,
 *   pay_plan, agent_company, company, w9, state, agent_address, agent_mls
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class AddMxidIndexesAndRemoveMlsNameUnique1769100000000 implements MigrationInterface {
	name = 'AddMxidIndexesAndRemoveMlsNameUnique1769100000000';

	// All tables that have the mxid column
	private readonly tablesWithMxid = [
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
		'state',
		'agent_address',
		'agent_mls',
	];

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add indexes on mxid column for all tables
		for (const table of this.tablesWithMxid) {
			const indexName = `IDX_${table}_mxid`;

			// Check if index already exists
			const indexExists = await queryRunner.query(`
				SELECT 1 FROM pg_indexes
				WHERE schemaname = 'core'
				  AND tablename = '${table}'
				  AND indexname = '${indexName}'
			`);

			if (indexExists.length === 0) {
				// First verify the column exists
				const columnExists = await queryRunner.query(`
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					  AND table_name = '${table}'
					  AND column_name = 'mxid'
				`);

				if (columnExists.length > 0) {
					await queryRunner.query(`
						CREATE INDEX "${indexName}" ON "core"."${table}" ("mxid")
					`);
				}
			}
		}

		// Remove unique constraint on mls.name
		const constraintExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			  AND table_name = 'mls'
			  AND constraint_name = 'UQ_mls_name'
			  AND constraint_type = 'UNIQUE'
		`);

		if (constraintExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."mls"
				DROP CONSTRAINT "UQ_mls_name"
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Re-add unique constraint on mls.name
		// First, remove any duplicate names (keep lowest id)
		await queryRunner.query(`
			DELETE FROM "core"."mls" m1
			USING "core"."mls" m2
			WHERE m1.id > m2.id
			AND LOWER(TRIM(m1.name)) = LOWER(TRIM(m2.name))
		`);

		// Trim whitespace from mls names
		await queryRunner.query(`
			UPDATE "core"."mls"
			SET name = TRIM(name)
			WHERE name != TRIM(name)
		`);

		// Check if constraint already exists before adding
		const constraintExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			  AND table_name = 'mls'
			  AND constraint_name = 'UQ_mls_name'
			  AND constraint_type = 'UNIQUE'
		`);

		if (constraintExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."mls"
				ADD CONSTRAINT "UQ_mls_name" UNIQUE ("name")
			`);
		}

		// Remove indexes on mxid column
		for (const table of this.tablesWithMxid) {
			const indexName = `IDX_${table}_mxid`;

			await queryRunner.query(`
				DROP INDEX IF EXISTS "core"."${indexName}"
			`);
		}
	}
}
