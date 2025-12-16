import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to change agent_mls.agent_id from bigint (legacy ID) to UUID (primary key).
 * This aligns the join table with the rest of the system that uses agent.id (UUID).
 */
export class MigrateAgentMlsToUuid1765900000000 implements MigrationInterface {
    name = 'MigrateAgentMlsToUuid1765900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if migration has already been applied (agent_id is already uuid type)
        const columnInfo = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_schema = 'core' 
            AND table_name = 'agent_mls' 
            AND column_name = 'agent_id'
        `);
        
        // If agent_id is already uuid, migration was already applied
        if (columnInfo.length > 0 && columnInfo[0].data_type === 'uuid') {
            return;
        }

        // Step 1: Add new UUID column (if not exists)
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ADD COLUMN IF NOT EXISTS "agent_uuid" uuid
        `);

        // Step 2: Populate the new column by looking up agent.id from agent.agent_id
        // Note: am.agent_id is bigint, a.agent_id is also bigint, so compare them directly
        await queryRunner.query(`
            UPDATE "core"."agent_mls" am
            SET "agent_uuid" = a."id"
            FROM "core"."agent" a
            WHERE am."agent_id"::text = a."agent_id"::text
        `);

        // Step 3: Delete orphaned records (where no matching agent was found)
        await queryRunner.query(`
            DELETE FROM "core"."agent_mls"
            WHERE "agent_uuid" IS NULL
        `);

        // Step 4: Drop the old primary key constraint
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP CONSTRAINT IF EXISTS "PK_agent_mls"
        `);
        
        // Also try the auto-generated constraint name
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP CONSTRAINT IF EXISTS "agent_mls_pkey"
        `);

        // Step 5: Drop the old agent_id column
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP COLUMN "agent_id"
        `);

        // Step 6: Rename agent_uuid to agent_id
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            RENAME COLUMN "agent_uuid" TO "agent_id"
        `);

        // Step 7: Make the new column NOT NULL
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ALTER COLUMN "agent_id" SET NOT NULL
        `);

        // Step 8: Create the new composite primary key
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ADD CONSTRAINT "PK_agent_mls" PRIMARY KEY ("agent_id", "mls_id")
        `);

        // Step 9: Add foreign key constraint to agent.id (UUID)
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ADD CONSTRAINT "FK_agent_mls_agent" 
            FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Step 10: Add foreign key constraint to mls.id (if not exists)
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP CONSTRAINT IF EXISTS "FK_agent_mls_mls"
        `);
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ADD CONSTRAINT "FK_agent_mls_mls" 
            FOREIGN KEY ("mls_id") REFERENCES "core"."mls"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Step 11: Create index on agent_id for faster lookups
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_agent_mls_agent_id" 
            ON "core"."agent_mls" ("agent_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the index
        await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_mls_agent_id"`);

        // Drop foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP CONSTRAINT IF EXISTS "FK_agent_mls_agent"
        `);
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP CONSTRAINT IF EXISTS "FK_agent_mls_mls"
        `);

        // Drop primary key
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP CONSTRAINT IF EXISTS "PK_agent_mls"
        `);

        // Rename agent_id back to agent_uuid temporarily
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            RENAME COLUMN "agent_id" TO "agent_uuid"
        `);

        // Add back the bigint agent_id column
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ADD COLUMN "agent_id" bigint
        `);

        // Populate from agent.agent_id
        await queryRunner.query(`
            UPDATE "core"."agent_mls" am
            SET "agent_id" = a."agent_id"
            FROM "core"."agent" a
            WHERE am."agent_uuid" = a."id"
        `);

        // Make NOT NULL
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ALTER COLUMN "agent_id" SET NOT NULL
        `);

        // Drop the UUID column
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            DROP COLUMN "agent_uuid"
        `);

        // Recreate primary key
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ADD CONSTRAINT "PK_agent_mls" PRIMARY KEY ("agent_id", "mls_id")
        `);

        // Re-add the original FK constraint
        await queryRunner.query(`
            ALTER TABLE "core"."agent_mls" 
            ADD CONSTRAINT "FK_b0f6195e4793254861d50da989a" 
            FOREIGN KEY ("mls_id") REFERENCES "core"."mls"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }
}
