import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds audit columns to core.line_of_business table.
 *
 * The InitialSchema migration created line_of_business with only (id, name).
 * The entity now extends AuditableEntity which requires:
 *   - created (timestamptz)
 *   - last_modified (timestamptz)
 *   - modified_by (text)
 *   - mxid (bigint, nullable)
 *
 * This migration is idempotent — safe to run multiple times.
 */
export class AddLineOfBusinessAuditColumns1771100000000 implements MigrationInterface {
	name = 'AddLineOfBusinessAuditColumns1771100000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add created column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'line_of_business'
					AND column_name = 'created'
				) THEN
					ALTER TABLE "core"."line_of_business"
						ADD COLUMN "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
				END IF;
			END $$;
		`)

		// Add last_modified column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'line_of_business'
					AND column_name = 'last_modified'
				) THEN
					ALTER TABLE "core"."line_of_business"
						ADD COLUMN "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
				END IF;
			END $$;
		`)

		// Add modified_by column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'line_of_business'
					AND column_name = 'modified_by'
				) THEN
					ALTER TABLE "core"."line_of_business"
						ADD COLUMN "modified_by" TEXT NOT NULL DEFAULT 'system';
				END IF;
			END $$;
		`)

		// Add mxid column if it doesn't exist
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'core'
					AND table_name = 'line_of_business'
					AND column_name = 'mxid'
				) THEN
					ALTER TABLE "core"."line_of_business"
						ADD COLUMN "mxid" BIGINT;
				END IF;
			END $$;
		`)

		// Add unique index on name to prevent duplicates at DB level
		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "uq_line_of_business_name"
			ON "core"."line_of_business" ("name")
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."uq_line_of_business_name"
		`)

		await queryRunner.query(`
			ALTER TABLE "core"."line_of_business"
				DROP COLUMN IF EXISTS "mxid",
				DROP COLUMN IF EXISTS "modified_by",
				DROP COLUMN IF EXISTS "last_modified",
				DROP COLUMN IF EXISTS "created"
		`)
	}
}
