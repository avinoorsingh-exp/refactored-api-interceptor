import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Replace plaintext tax ID columns with encrypted PII columns.
 *
 * Since this feature branch has no production data, old columns are DROPPED
 * (not renamed). New columns follow the envelope-encryption model:
 *   - tax_id / type_value   → BYTEA (AES-256-GCM ciphertext)
 *   - tax_id_hashed / type_hashed → CHAR(64) (HMAC-SHA256 blind index)
 *   - tax_id_last4 / type_last4   → CHAR(4) (display-only)
 *   - encryption_key_id   → VARCHAR(256) (which DEK was used)
 *   - encryption_version  → SMALLINT (encryption scheme version)
 *   - encrypted_at        → TIMESTAMPTZ (when encryption occurred)
 *
 * Both core.tax and core.agent_company use the same column naming pattern.
 * All new columns are nullable to allow staged backfill.
 */
export class AddEncryptedPiiColumns1770800000000 implements MigrationInterface {
	name = 'AddEncryptedPiiColumns1770800000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// =================================================================
		// TAX TABLE
		// =================================================================

		// Step 1: Drop old plaintext columns
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."IDX_tax_value_hashed"
		`)

		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				DROP COLUMN "value",
				DROP COLUMN "value_hashed"
		`)

		// Step 2: Add new encrypted columns

		// type_value: AES-256-GCM ciphertext of the tax ID type value
		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD COLUMN "type_value" BYTEA
		`)

		// type_hashed: HMAC-SHA256 blind index for equality lookups
		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD COLUMN "type_hashed" CHAR(64)
		`)

		// type_last4: last 4 digits of the tax ID (display only, never encrypted)
		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD COLUMN "type_last4" CHAR(4)
		`)

		// encryption_key_id: identifier for the DEK/key-version used to encrypt tax_id
		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD COLUMN "encryption_key_id" VARCHAR(256)
		`)

		// encryption_version: encryption scheme version (1 = AES-256-GCM via @aws-crypto v4)
		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD COLUMN "encryption_version" SMALLINT
		`)

		// encrypted_at: timestamp of when the value was encrypted (or re-encrypted)
		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD COLUMN "encrypted_at" TIMESTAMPTZ
		`)

		// Step 3: Add indexes
		await queryRunner.query(`
			CREATE INDEX "IDX_tax_type_hashed"
			ON "core"."tax" ("type_hashed")
		`)

		// Step 4: Add CHECK constraints
		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD CONSTRAINT "CHK_tax_type_last4"
				CHECK ("type_last4" IS NULL OR "type_last4" ~ '^[0-9]{4}$')
		`)

		await queryRunner.query(`
			ALTER TABLE "core"."tax"
				ADD CONSTRAINT "CHK_tax_type_hashed"
				CHECK ("type_hashed" IS NULL OR "type_hashed" ~ '^[0-9a-f]{64}$')
		`)

		// =================================================================
		// AGENT_COMPANY TABLE
		// =================================================================

		// Step 5: Drop old plaintext columns
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				DROP COLUMN "tax_id",
				DROP COLUMN "tax_id_hashed"
		`)

		// Step 6: Add new encrypted columns

		// tax_id: AES-256-GCM ciphertext
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD COLUMN "tax_id" BYTEA
		`)

		// tax_id_hashed: HMAC-SHA256 blind index
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD COLUMN "tax_id_hashed" CHAR(64)
		`)

		// tax_id_last4: last 4 digits (display only)
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD COLUMN "tax_id_last4" CHAR(4)
		`)

		// encryption_key_id: which DEK was used
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD COLUMN "encryption_key_id" VARCHAR(256)
		`)

		// encryption_version: encryption scheme version
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD COLUMN "encryption_version" SMALLINT
		`)

		// encrypted_at: when encryption occurred
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD COLUMN "encrypted_at" TIMESTAMPTZ
		`)

		// Step 7: Add indexes
		await queryRunner.query(`
			CREATE INDEX "IDX_agent_company_tax_id_hashed"
			ON "core"."agent_company" ("tax_id_hashed")
		`)

		// Step 8: Add CHECK constraints
		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD CONSTRAINT "CHK_agent_company_tax_id_last4"
				CHECK ("tax_id_last4" IS NULL OR "tax_id_last4" ~ '^[0-9]{4}$')
		`)

		await queryRunner.query(`
			ALTER TABLE "core"."agent_company"
				ADD CONSTRAINT "CHK_agent_company_tax_id_hashed"
				CHECK ("tax_id_hashed" IS NULL OR "tax_id_hashed" ~ '^[0-9a-f]{64}$')
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// =================================================================
		// AGENT_COMPANY TABLE — revert
		// =================================================================

		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP CONSTRAINT IF EXISTS "CHK_agent_company_tax_id_hashed"`)
		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP CONSTRAINT IF EXISTS "CHK_agent_company_tax_id_last4"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_company_tax_id_hashed"`)

		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP COLUMN IF EXISTS "encrypted_at"`)
		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP COLUMN IF EXISTS "encryption_version"`)
		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP COLUMN IF EXISTS "encryption_key_id"`)
		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP COLUMN IF EXISTS "tax_id_last4"`)
		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP COLUMN IF EXISTS "tax_id_hashed"`)
		await queryRunner.query(`ALTER TABLE "core"."agent_company" DROP COLUMN IF EXISTS "tax_id"`)

		// Restore original columns
		await queryRunner.query(`ALTER TABLE "core"."agent_company" ADD COLUMN "tax_id" text`)
		await queryRunner.query(`ALTER TABLE "core"."agent_company" ADD COLUMN "tax_id_hashed" text`)

		// =================================================================
		// TAX TABLE — revert
		// =================================================================

		await queryRunner.query(`ALTER TABLE "core"."tax" DROP CONSTRAINT IF EXISTS "CHK_tax_type_hashed"`)
		await queryRunner.query(`ALTER TABLE "core"."tax" DROP CONSTRAINT IF EXISTS "CHK_tax_type_last4"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_tax_type_hashed"`)

		await queryRunner.query(`ALTER TABLE "core"."tax" DROP COLUMN IF EXISTS "encrypted_at"`)
		await queryRunner.query(`ALTER TABLE "core"."tax" DROP COLUMN IF EXISTS "encryption_version"`)
		await queryRunner.query(`ALTER TABLE "core"."tax" DROP COLUMN IF EXISTS "encryption_key_id"`)
		await queryRunner.query(`ALTER TABLE "core"."tax" DROP COLUMN IF EXISTS "type_last4"`)
		await queryRunner.query(`ALTER TABLE "core"."tax" DROP COLUMN IF EXISTS "type_hashed"`)
		await queryRunner.query(`ALTER TABLE "core"."tax" DROP COLUMN IF EXISTS "type_value"`)

		// Restore original columns
		await queryRunner.query(`ALTER TABLE "core"."tax" ADD COLUMN "value" text NOT NULL DEFAULT ''`)
		await queryRunner.query(`ALTER TABLE "core"."tax" ADD COLUMN "value_hashed" text`)
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tax_value_hashed" ON "core"."tax" ("value_hashed")`)
	}
}
