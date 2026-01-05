import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to update agent_company table to match ERD and use standard AuditableEntity fields.
 *
 * Changes:
 * 1. Change legacy_id column type from uuid to bigint
 * 2. Rename created_at → created
 * 3. Rename updated_at → last_modified
 * 4. Add modified_by column with default 'system'
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class UpdateAgentCompanyAuditFields1766700000000 implements MigrationInterface {
	name = 'UpdateAgentCompanyAuditFields1766700000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Step 1: Change legacy_id from uuid to bigint
		const legacyIdColumn = await queryRunner.query(`
			SELECT data_type
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'legacy_id'
		`);

		if (legacyIdColumn.length > 0 && legacyIdColumn[0].data_type === 'uuid') {
			// Delete existing data - uuid values cannot be converted to bigint
			// Use TRUNCATE CASCADE to handle FK dependencies (agent -> agent_company)
			await queryRunner.query(`
				TRUNCATE TABLE "core"."agent_company" CASCADE
			`);

			// Drop NOT NULL constraint temporarily, change type, then restore
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ALTER COLUMN "legacy_id" DROP NOT NULL
			`);

			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ALTER COLUMN "legacy_id" TYPE bigint USING NULL
			`);

			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ALTER COLUMN "legacy_id" SET NOT NULL
			`);
		}

		// Step 2: Rename created_at to created (if needed)
		const hasCreatedAt = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'created_at'
		`);

		if (hasCreatedAt.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				RENAME COLUMN "created_at" TO "created"
			`);
		}

		// Step 3: Rename updated_at to last_modified (if needed)
		const hasUpdatedAt = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'updated_at'
		`);

		if (hasUpdatedAt.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				RENAME COLUMN "updated_at" TO "last_modified"
			`);
		}

		// Step 4: Add modified_by column if it doesn't exist
		const hasModifiedBy = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'modified_by'
		`);

		if (hasModifiedBy.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ADD COLUMN "modified_by" text NOT NULL DEFAULT 'system'
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Step 1: Remove modified_by column
		const hasModifiedBy = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'modified_by'
		`);

		if (hasModifiedBy.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				DROP COLUMN "modified_by"
			`);
		}

		// Step 2: Rename last_modified back to updated_at
		const hasLastModified = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'last_modified'
		`);

		if (hasLastModified.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				RENAME COLUMN "last_modified" TO "updated_at"
			`);
		}

		// Step 3: Rename created back to created_at
		const hasCreated = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'created'
		`);

		if (hasCreated.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				RENAME COLUMN "created" TO "created_at"
			`);
		}

		// Step 4: Change legacy_id back from bigint to uuid
		const legacyIdColumn = await queryRunner.query(`
			SELECT data_type
			FROM information_schema.columns
			WHERE table_schema = 'core'
			  AND table_name = 'agent_company'
			  AND column_name = 'legacy_id'
		`);

		if (legacyIdColumn.length > 0 && legacyIdColumn[0].data_type === 'bigint') {
			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ALTER COLUMN "legacy_id" DROP NOT NULL
			`);

			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ALTER COLUMN "legacy_id" TYPE uuid USING uuid_generate_v4()
			`);

			await queryRunner.query(`
				ALTER TABLE "core"."agent_company"
				ALTER COLUMN "legacy_id" SET NOT NULL
			`);
		}
	}
}
