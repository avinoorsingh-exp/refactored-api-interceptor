import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to recreate the office table with BigInt primary key and company relationship.
 * 
 * Changes:
 * - Change id from UUID to BigInt (auto-increment)
 * - Remove office_id column (was redundant)
 * - Add company_id foreign key to company table
 * - Add audit fields (created, last_modified, modified_by)
 * 
 * WARNING: This migration drops and recreates tables. All existing office data will be lost.
 * Only use in development environments.
 */
export class RecreateOfficeTableWithBigInt1763139200000 implements MigrationInterface {
    name = 'RecreateOfficeTableWithBigInt1763139200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints from related tables first
        await queryRunner.query(`ALTER TABLE "core"."office_address" DROP CONSTRAINT IF EXISTS "FK_f43f4200662b0ce7beddd29c3f5"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_office" DROP CONSTRAINT IF EXISTS "FK_a9e9433cfd2dda289a647c12c45"`);
        await queryRunner.query(`ALTER TABLE "core"."office_external_reference" DROP CONSTRAINT IF EXISTS "FK_bf9d6c6c7c8ce63e0326f4a51b4"`);

        // Drop related tables that reference office
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."office_address"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."agent_office"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."office_external_reference"`);

        // Drop the office table
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."office"`);

        // Create sequence for office id
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "core"."office_id_seq" AS bigint`);

        // Recreate office table with new structure
        await queryRunner.query(`
            CREATE TABLE "core"."office" (
                "id" bigint NOT NULL DEFAULT nextval('core.office_id_seq'),
                "website" text,
                "name" text NOT NULL,
                "phone" text NOT NULL,
                "lifecycle_status" text NOT NULL,
                "primary_state" character varying(200) NOT NULL,
                "company_id" bigint NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "modified_by" text NOT NULL DEFAULT 'system',
                CONSTRAINT "PK_office_id" PRIMARY KEY ("id")
            )
        `);

        // Set sequence ownership
        await queryRunner.query(`ALTER SEQUENCE "core"."office_id_seq" OWNED BY "core"."office"."id"`);

        // Add foreign key constraint to company
        await queryRunner.query(`
            ALTER TABLE "core"."office" 
            ADD CONSTRAINT "FK_office_company" 
            FOREIGN KEY ("company_id") 
            REFERENCES "core"."company"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Recreate office_external_reference table with bigint office_id
        await queryRunner.query(`
            CREATE TABLE "core"."office_external_reference" (
                "office_id" bigint NOT NULL,
                "external_reference_id" uuid NOT NULL,
                CONSTRAINT "PK_office_external_reference" PRIMARY KEY ("office_id", "external_reference_id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_external_reference" 
            ADD CONSTRAINT "FK_office_ext_ref_office" 
            FOREIGN KEY ("office_id") 
            REFERENCES "core"."office"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_external_reference" 
            ADD CONSTRAINT "FK_office_ext_ref_external_reference" 
            FOREIGN KEY ("external_reference_id") 
            REFERENCES "core"."external_reference"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Recreate agent_office table with bigint office_id
        await queryRunner.query(`
            CREATE TABLE "core"."agent_office" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "is_primary" boolean NOT NULL,
                "agent_id" uuid NOT NULL,
                "office_id" bigint NOT NULL,
                CONSTRAINT "PK_agent_office" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."agent_office" 
            ADD CONSTRAINT "FK_agent_office_agent" 
            FOREIGN KEY ("agent_id") 
            REFERENCES "core"."agent"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."agent_office" 
            ADD CONSTRAINT "FK_agent_office_office" 
            FOREIGN KEY ("office_id") 
            REFERENCES "core"."office"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Recreate office_address table with bigint office_id
        await queryRunner.query(`
            CREATE TABLE "core"."office_address" (
                "office_id" bigint NOT NULL,
                "address_id" uuid NOT NULL,
                CONSTRAINT "PK_office_address" PRIMARY KEY ("office_id", "address_id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_address" 
            ADD CONSTRAINT "FK_office_address_office" 
            FOREIGN KEY ("office_id") 
            REFERENCES "core"."office"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_address" 
            ADD CONSTRAINT "FK_office_address_address" 
            FOREIGN KEY ("address_id") 
            REFERENCES "core"."address"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Create indexes for performance
        await queryRunner.query(`CREATE INDEX "IDX_office_company_id" ON "core"."office" ("company_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_office_lifecycle_status" ON "core"."office" ("lifecycle_status")`);
        await queryRunner.query(`CREATE INDEX "IDX_office_name" ON "core"."office" ("name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_office_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_office_lifecycle_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_office_company_id"`);

        // Drop foreign key constraints from related tables
        await queryRunner.query(`ALTER TABLE "core"."office_address" DROP CONSTRAINT IF EXISTS "FK_office_address_address"`);
        await queryRunner.query(`ALTER TABLE "core"."office_address" DROP CONSTRAINT IF EXISTS "FK_office_address_office"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_office" DROP CONSTRAINT IF EXISTS "FK_agent_office_office"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_office" DROP CONSTRAINT IF EXISTS "FK_agent_office_agent"`);
        await queryRunner.query(`ALTER TABLE "core"."office_external_reference" DROP CONSTRAINT IF EXISTS "FK_office_ext_ref_external_reference"`);
        await queryRunner.query(`ALTER TABLE "core"."office_external_reference" DROP CONSTRAINT IF EXISTS "FK_office_ext_ref_office"`);
        await queryRunner.query(`ALTER TABLE "core"."office" DROP CONSTRAINT IF EXISTS "FK_office_company"`);

        // Drop related tables
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."office_address"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."agent_office"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."office_external_reference"`);

        // Drop office table and sequence
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."office"`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS "core"."office_id_seq"`);

        // Recreate original office table with UUID
        await queryRunner.query(`
            CREATE TABLE "core"."office" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "office_id" bigint NOT NULL,
                "website" text,
                "name" text NOT NULL,
                "phone" text NOT NULL,
                "lifecycle_status" text NOT NULL,
                "primary_state" character varying(200) NOT NULL,
                CONSTRAINT "PK_200185316ba169fda17e3b6ba00" PRIMARY KEY ("id")
            )
        `);

        // Recreate original office_external_reference table
        await queryRunner.query(`
            CREATE TABLE "core"."office_external_reference" (
                "office_id" uuid NOT NULL,
                "external_reference_id" uuid NOT NULL,
                CONSTRAINT "PK_625031fa773b30175e134c748e2" PRIMARY KEY ("office_id", "external_reference_id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_external_reference" 
            ADD CONSTRAINT "FK_bf9d6c6c7c8ce63e0326f4a51b4" 
            FOREIGN KEY ("office_id") 
            REFERENCES "core"."office"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_external_reference" 
            ADD CONSTRAINT "FK_21ff193616770559463efbf0396" 
            FOREIGN KEY ("external_reference_id") 
            REFERENCES "core"."external_reference"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Recreate original agent_office table
        await queryRunner.query(`
            CREATE TABLE "core"."agent_office" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "is_primary" boolean NOT NULL,
                "agent_id" uuid NOT NULL,
                "office_id" uuid NOT NULL,
                CONSTRAINT "PK_93b7fd326a55886fd710554e002" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."agent_office" 
            ADD CONSTRAINT "FK_f5ec523ddd694262dfccc237284" 
            FOREIGN KEY ("agent_id") 
            REFERENCES "core"."agent"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."agent_office" 
            ADD CONSTRAINT "FK_a9e9433cfd2dda289a647c12c45" 
            FOREIGN KEY ("office_id") 
            REFERENCES "core"."office"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Recreate original office_address table
        await queryRunner.query(`
            CREATE TABLE "core"."office_address" (
                "office_id" uuid NOT NULL,
                "address_id" uuid NOT NULL,
                CONSTRAINT "PK_cf2885779369d5f8aedefa01285" PRIMARY KEY ("office_id", "address_id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_address" 
            ADD CONSTRAINT "FK_f43f4200662b0ce7beddd29c3f5" 
            FOREIGN KEY ("office_id") 
            REFERENCES "core"."office"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "core"."office_address" 
            ADD CONSTRAINT "FK_7bdca8d5b21da2a36e0fc9a3c22" 
            FOREIGN KEY ("address_id") 
            REFERENCES "core"."address"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }
}
