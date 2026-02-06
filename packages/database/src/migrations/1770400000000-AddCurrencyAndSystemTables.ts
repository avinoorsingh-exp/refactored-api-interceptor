import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCurrencyAndSystemTables1770400000000 implements MigrationInterface {
	name = 'AddCurrencyAndSystemTables1770400000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create currency table (ISO 4217)
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "core"."currency" (
				"id" SERIAL PRIMARY KEY,
				"code" VARCHAR(3) NOT NULL UNIQUE,
				"number" INTEGER NOT NULL UNIQUE,
				"name" TEXT NOT NULL,
				"symbol" VARCHAR(10),
				"minor_units" INTEGER NOT NULL DEFAULT 2,
				"created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"modified_by" TEXT NOT NULL DEFAULT 'system',
				"mxid" BIGINT
			)
		`)

		// Create system table
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "core"."system" (
				"id" BIGSERIAL PRIMARY KEY,
				"country_id" INTEGER NOT NULL,
				"currency_id" INTEGER NOT NULL,
				"description" TEXT NOT NULL,
				"created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"modified_by" TEXT NOT NULL DEFAULT 'system',
				"mxid" BIGINT,
				CONSTRAINT "fk_system_country" FOREIGN KEY ("country_id") REFERENCES "core"."country"("id") ON DELETE RESTRICT,
				CONSTRAINT "fk_system_currency" FOREIGN KEY ("currency_id") REFERENCES "core"."currency"("id") ON DELETE RESTRICT
			)
		`)

		// Create indexes for system table
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_system_country" ON "core"."system" ("country_id")
		`)

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_system_currency" ON "core"."system" ("currency_id")
		`)

		// Create index on currency code for faster lookups
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_currency_code" ON "core"."currency" ("code")
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."idx_currency_code"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."idx_system_currency"`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."idx_system_country"`)

		// Drop tables (system first due to FK constraints)
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."system"`)
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."currency"`)
	}
}
