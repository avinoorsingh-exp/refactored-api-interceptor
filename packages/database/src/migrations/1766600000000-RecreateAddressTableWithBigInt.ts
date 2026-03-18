import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to recreate the address table with BigInt primary key.
 *
 * Changes:
 * - Change address.id from UUID to BigInt (auto-increment)
 * - Update agent_address.address_id foreign key to BigInt
 *
 * WARNING: This migration drops and recreates tables. All existing address data will be lost.
 * Only use in development environments.
 */
export class RecreateAddressTableWithBigInt1766600000000 implements MigrationInterface {
	name = 'RecreateAddressTableWithBigInt1766600000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Drop foreign key constraints from related tables first
		await queryRunner.query(`ALTER TABLE "core"."agent_address" DROP CONSTRAINT IF EXISTS "FK_agent_address_address"`)
		await queryRunner.query(
			`ALTER TABLE "core"."agent_address" DROP CONSTRAINT IF EXISTS "FK_agent_address_address_id"`,
		)
		await queryRunner.query(`ALTER TABLE "core"."office_address" DROP CONSTRAINT IF EXISTS "FK_office_address_address"`)
		await queryRunner.query(`ALTER TABLE "core"."w9_address" DROP CONSTRAINT IF EXISTS "FK_w9_address_address"`)

		// Drop MLS foreign key to address (auto-generated constraint name)
		await queryRunner.query(`ALTER TABLE "core"."mls" DROP CONSTRAINT IF EXISTS "FK_7074a63c12a6454117ad5c3f3a3"`)
		await queryRunner.query(`ALTER TABLE "core"."mls" DROP CONSTRAINT IF EXISTS "FK_mls_address"`)

		// Drop related junction tables that reference address
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."agent_address"`)
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."office_address"`)
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."w9_address"`)

		// Drop the address table
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."address"`)

		// Create sequence for address id
		await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "core"."address_id_seq" AS bigint`)

		// Recreate address table with BigInt primary key and all columns from schema
		await queryRunner.query(`
            CREATE TABLE "core"."address" (
                "id" bigint NOT NULL DEFAULT nextval('core.address_id_seq'),
                "type" text,
                "role" text,
                "line_1" text NOT NULL,
                "line_2" text,
                "city" text NOT NULL,
                "unit" text,
                "postal_code" text NOT NULL,
                "county" text,
                "label" text,
                "state_id" uuid,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "modified_by" text NOT NULL DEFAULT 'system',
                CONSTRAINT "PK_address_id" PRIMARY KEY ("id")
            )
        `)

		// Set sequence ownership
		await queryRunner.query(`ALTER SEQUENCE "core"."address_id_seq" OWNED BY "core"."address"."id"`)

		// Add foreign key to state
		await queryRunner.query(`
            ALTER TABLE "core"."address"
            ADD CONSTRAINT "FK_address_state"
            FOREIGN KEY ("state_id")
            REFERENCES "core"."state"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION
        `)

		// Recreate agent_address junction table with composite PK (agent_id, address_id)
		await queryRunner.query(`
            CREATE TABLE "core"."agent_address" (
                "agent_id" uuid NOT NULL,
                "address_id" bigint NOT NULL,
                "is_primary" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_agent_address" PRIMARY KEY ("agent_id", "address_id")
            )
        `)

		// Add foreign key constraints for agent_address
		await queryRunner.query(`
            ALTER TABLE "core"."agent_address"
            ADD CONSTRAINT "FK_agent_address_agent"
            FOREIGN KEY ("agent_id")
            REFERENCES "core"."agent"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		await queryRunner.query(`
            ALTER TABLE "core"."agent_address"
            ADD CONSTRAINT "FK_agent_address_address"
            FOREIGN KEY ("address_id")
            REFERENCES "core"."address"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		// Add unique constraint to prevent duplicate primary addresses per agent
		await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_agent_address_unique_primary"
            ON "core"."agent_address" ("agent_id")
            WHERE ("is_primary" = true)
        `)

		// Recreate office_address junction table with BigInt address_id
		await queryRunner.query(`
            CREATE TABLE "core"."office_address" (
                "office_id" bigint NOT NULL,
                "address_id" bigint NOT NULL,
                CONSTRAINT "PK_office_address" PRIMARY KEY ("office_id", "address_id")
            )
        `)

		await queryRunner.query(`
            ALTER TABLE "core"."office_address"
            ADD CONSTRAINT "FK_office_address_office"
            FOREIGN KEY ("office_id")
            REFERENCES "core"."office"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		await queryRunner.query(`
            ALTER TABLE "core"."office_address"
            ADD CONSTRAINT "FK_office_address_address"
            FOREIGN KEY ("address_id")
            REFERENCES "core"."address"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		// Recreate w9_address junction table with BigInt address_id
		await queryRunner.query(`
            CREATE TABLE "core"."w9_address" (
                "w9_id" uuid NOT NULL,
                "address_id" bigint NOT NULL,
                CONSTRAINT "PK_w9_address" PRIMARY KEY ("w9_id", "address_id")
            )
        `)

		await queryRunner.query(`
            ALTER TABLE "core"."w9_address"
            ADD CONSTRAINT "FK_w9_address_w9"
            FOREIGN KEY ("w9_id")
            REFERENCES "core"."w9"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		await queryRunner.query(`
            ALTER TABLE "core"."w9_address"
            ADD CONSTRAINT "FK_w9_address_address"
            FOREIGN KEY ("address_id")
            REFERENCES "core"."address"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		// Update MLS table: change address_id from UUID to BigInt
		// First drop the column and recreate with correct type
		await queryRunner.query(`ALTER TABLE "core"."mls" DROP COLUMN IF EXISTS "address_id"`)
		await queryRunner.query(`ALTER TABLE "core"."mls" ADD COLUMN "address_id" bigint NULL`)

		// Add back the MLS foreign key to address (now BigInt)
		await queryRunner.query(`
            ALTER TABLE "core"."mls"
            ADD CONSTRAINT "FK_mls_address"
            FOREIGN KEY ("address_id")
            REFERENCES "core"."address"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION
        `)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop FK constraints first
		await queryRunner.query(`ALTER TABLE "core"."address" DROP CONSTRAINT IF EXISTS "FK_address_state"`)

		// Drop junction tables
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."w9_address"`)
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."office_address"`)
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."agent_address"`)

		// Drop address table and sequence
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."address"`)
		await queryRunner.query(`DROP SEQUENCE IF EXISTS "core"."address_id_seq"`)

		// Recreate original address table with UUID (old schema)
		await queryRunner.query(`
            CREATE TABLE "core"."address" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "line1" text NOT NULL,
                "line2" text,
                "city" text NOT NULL,
                "unit" text NOT NULL,
                "postal_code" text NOT NULL,
                "country" char(2) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_address_id" PRIMARY KEY ("id")
            )
        `)

		// Recreate agent_address with UUID address_id
		await queryRunner.query(`
            CREATE TABLE "core"."agent_address" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "agent_id" uuid NOT NULL,
                "address_id" uuid NOT NULL,
                "role" varchar(20),
                "is_primary" boolean NOT NULL DEFAULT false,
                "valid_from" date,
                "valid_to" date,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_agent_address_id" PRIMARY KEY ("id")
            )
        `)

		await queryRunner.query(`
            ALTER TABLE "core"."agent_address"
            ADD CONSTRAINT "FK_agent_address_agent"
            FOREIGN KEY ("agent_id")
            REFERENCES "core"."agent"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		await queryRunner.query(`
            ALTER TABLE "core"."agent_address"
            ADD CONSTRAINT "FK_agent_address_address"
            FOREIGN KEY ("address_id")
            REFERENCES "core"."address"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

		// Recreate office_address with UUID address_id
		await queryRunner.query(`
            CREATE TABLE "core"."office_address" (
                "office_id" bigint NOT NULL,
                "address_id" uuid NOT NULL,
                CONSTRAINT "PK_office_address" PRIMARY KEY ("office_id", "address_id")
            )
        `)

		// Recreate w9_address with UUID address_id
		await queryRunner.query(`
            CREATE TABLE "core"."w9_address" (
                "w9_id" uuid NOT NULL,
                "address_id" uuid NOT NULL,
                CONSTRAINT "PK_w9_address" PRIMARY KEY ("w9_id", "address_id")
            )
        `)

		// Restore MLS address_id to UUID
		await queryRunner.query(`ALTER TABLE "core"."mls" DROP CONSTRAINT IF EXISTS "FK_mls_address"`)
		await queryRunner.query(`ALTER TABLE "core"."mls" DROP COLUMN IF EXISTS "address_id"`)
		await queryRunner.query(`ALTER TABLE "core"."mls" ADD COLUMN "address_id" uuid NULL`)
	}
}
