import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Aligns the external_reference table with FullAuditableEntity conventions.
 *
 * - Renames created_at → created, updated_at → last_modified
 * - Adds modified_by, created_by, mxid columns
 * - Adds ON DELETE CASCADE to all junction table foreign keys
 *
 * Data is not preserved — columns are renamed/added with defaults.
 */
export class AlignExternalReferenceAuditColumns1771400000000 implements MigrationInterface {
	name = 'AlignExternalReferenceAuditColumns1771400000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ── Rename timestamp columns ──
		await queryRunner.query(`
			ALTER TABLE "core"."external_reference"
			RENAME COLUMN "created_at" TO "created"
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."external_reference"
			RENAME COLUMN "updated_at" TO "last_modified"
		`)

		// ── Add FullAuditableEntity columns ──
		await queryRunner.query(`
			ALTER TABLE "core"."external_reference"
			ADD COLUMN "modified_by" text NOT NULL DEFAULT 'system'
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."external_reference"
			ADD COLUMN "created_by" text NOT NULL DEFAULT 'system'
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."external_reference"
			ADD COLUMN "mxid" bigint NULL
		`)

		// ── Add CASCADE to agent_external_reference FKs ──
		// Drop existing FKs (name may vary — drop by column match)
		await queryRunner.query(`
			DO $$ DECLARE r RECORD;
			BEGIN
				FOR r IN (
					SELECT con.conname
					FROM pg_constraint con
					JOIN pg_class c ON c.oid = con.conrelid
					JOIN pg_namespace n ON n.oid = c.relnamespace
					WHERE n.nspname = 'core'
					AND c.relname = 'agent_external_reference'
					AND con.contype = 'f'
				) LOOP
					EXECUTE 'ALTER TABLE core.agent_external_reference DROP CONSTRAINT ' || quote_ident(r.conname);
				END LOOP;
			END $$
		`)

		await queryRunner.query(`
			ALTER TABLE "core"."agent_external_reference"
			ADD CONSTRAINT "FK_agent_ext_ref_agent"
			FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."agent_external_reference"
			ADD CONSTRAINT "FK_agent_ext_ref_ext_ref"
			FOREIGN KEY ("external_reference_id") REFERENCES "core"."external_reference"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)

		// ── Add CASCADE to office_external_reference FKs ──
		await queryRunner.query(`
			DO $$ DECLARE r RECORD;
			BEGIN
				FOR r IN (
					SELECT con.conname
					FROM pg_constraint con
					JOIN pg_class c ON c.oid = con.conrelid
					JOIN pg_namespace n ON n.oid = c.relnamespace
					WHERE n.nspname = 'core'
					AND c.relname = 'office_external_reference'
					AND con.contype = 'f'
				) LOOP
					EXECUTE 'ALTER TABLE core.office_external_reference DROP CONSTRAINT ' || quote_ident(r.conname);
				END LOOP;
			END $$
		`)

		await queryRunner.query(`
			ALTER TABLE "core"."office_external_reference"
			ADD CONSTRAINT "FK_office_ext_ref_office"
			FOREIGN KEY ("office_id") REFERENCES "core"."office"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."office_external_reference"
			ADD CONSTRAINT "FK_office_ext_ref_ext_ref"
			FOREIGN KEY ("external_reference_id") REFERENCES "core"."external_reference"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)

		// ── Add CASCADE to company_external_reference FKs ──
		await queryRunner.query(`
			DO $$ DECLARE r RECORD;
			BEGIN
				FOR r IN (
					SELECT con.conname
					FROM pg_constraint con
					JOIN pg_class c ON c.oid = con.conrelid
					JOIN pg_namespace n ON n.oid = c.relnamespace
					WHERE n.nspname = 'core'
					AND c.relname = 'company_external_reference'
					AND con.contype = 'f'
				) LOOP
					EXECUTE 'ALTER TABLE core.company_external_reference DROP CONSTRAINT ' || quote_ident(r.conname);
				END LOOP;
			END $$
		`)

		await queryRunner.query(`
			ALTER TABLE "core"."company_external_reference"
			ADD CONSTRAINT "FK_company_ext_ref_company"
			FOREIGN KEY ("company_id") REFERENCES "core"."company"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)
		await queryRunner.query(`
			ALTER TABLE "core"."company_external_reference"
			ADD CONSTRAINT "FK_company_ext_ref_ext_ref"
			FOREIGN KEY ("external_reference_id") REFERENCES "core"."external_reference"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`)

		// ── Indexes on junction tables for efficient lookups ──
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_ext_ref_agent_id"
			ON "core"."agent_external_reference" ("agent_id")
		`)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_office_ext_ref_office_id"
			ON "core"."office_external_reference" ("office_id")
		`)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_company_ext_ref_company_id"
			ON "core"."company_external_reference" ("company_id")
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_company_ext_ref_company_id"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_office_ext_ref_office_id"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_ext_ref_agent_id"`)

		// Revert columns
		await queryRunner.query(`ALTER TABLE "core"."external_reference" DROP COLUMN IF EXISTS "mxid"`)
		await queryRunner.query(`ALTER TABLE "core"."external_reference" DROP COLUMN IF EXISTS "created_by"`)
		await queryRunner.query(`ALTER TABLE "core"."external_reference" DROP COLUMN IF EXISTS "modified_by"`)
		await queryRunner.query(`ALTER TABLE "core"."external_reference" RENAME COLUMN "last_modified" TO "updated_at"`)
		await queryRunner.query(`ALTER TABLE "core"."external_reference" RENAME COLUMN "created" TO "created_at"`)
	}
}
