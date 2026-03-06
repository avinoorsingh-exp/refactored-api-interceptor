import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to change active_location.agent_id and sponsor_configuration.agent_id
 * from bigint (legacy ID) to UUID (primary key reference).
 * 
 * This aligns these tables with the rest of the system that uses agent.id (UUID)
 * as the foreign key reference instead of agent.agent_id (bigint).
 * 
 * Affected tables:
 * - core.active_location (composite PK: name + agent_id)
 * - core.sponsor_configuration (PK: agent_id)
 * 
 * This migration is idempotent - it checks column types before making changes.
 */
export class MigrateAgentForeignKeysToUuid1765940000000 implements MigrationInterface {
    name = 'MigrateAgentForeignKeysToUuid1765940000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ============================================
        // ACTIVE_LOCATION TABLE
        // ============================================
        await this.migrateActiveLocation(queryRunner);

        // ============================================
        // SPONSOR_CONFIGURATION TABLE
        // ============================================
        await this.migrateSponsorConfiguration(queryRunner);
    }

    private async migrateActiveLocation(queryRunner: QueryRunner): Promise<void> {
        // Check if migration has already been applied (agent_id is already uuid type)
        const columnInfo = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_schema = 'core' 
            AND table_name = 'active_location' 
            AND column_name = 'agent_id'
        `);
        
        // If agent_id is already uuid, migration was already applied
        if (columnInfo.length > 0 && columnInfo[0].data_type === 'uuid') {
            return;
        }

        // If table doesn't exist or column doesn't exist, skip
        if (columnInfo.length === 0) {
            return;
        }

        // Step 1: Add new UUID column
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            ADD COLUMN IF NOT EXISTS "agent_uuid" uuid
        `);

        // Step 2: Populate the new column by looking up agent.id from agent.agent_id
        await queryRunner.query(`
            UPDATE "core"."active_location" al
            SET "agent_uuid" = a."id"
            FROM "core"."agent" a
            WHERE al."agent_id"::text = a."agent_id"::text
        `);

        // Step 3: Delete orphaned records (where no matching agent was found)
        await queryRunner.query(`
            DELETE FROM "core"."active_location"
            WHERE "agent_uuid" IS NULL
        `);

        // Step 4: Drop the old primary key constraint
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            DROP CONSTRAINT IF EXISTS "PK_active_location"
        `);
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            DROP CONSTRAINT IF EXISTS "active_location_pkey"
        `);

        // Step 5: Drop the old agent_id column
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            DROP COLUMN "agent_id"
        `);

        // Step 6: Rename agent_uuid to agent_id
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            RENAME COLUMN "agent_uuid" TO "agent_id"
        `);

        // Step 7: Make the new column NOT NULL
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            ALTER COLUMN "agent_id" SET NOT NULL
        `);

        // Step 8: Create the new composite primary key (name + agent_id)
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            ADD CONSTRAINT "PK_active_location" PRIMARY KEY ("name", "agent_id")
        `);

        // Step 9: Add foreign key constraint to agent.id (UUID)
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            ADD CONSTRAINT "FK_active_location_agent" 
            FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Step 10: Create index on agent_id for faster lookups
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_active_location_agent_id" 
            ON "core"."active_location" ("agent_id")
        `);
    }

    private async migrateSponsorConfiguration(queryRunner: QueryRunner): Promise<void> {
        // Check if migration has already been applied (agent_id is already uuid type)
        const columnInfo = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_schema = 'core' 
            AND table_name = 'sponsor_configuration' 
            AND column_name = 'agent_id'
        `);
        
        // If agent_id is already uuid, migration was already applied
        if (columnInfo.length > 0 && columnInfo[0].data_type === 'uuid') {
            return;
        }

        // If table doesn't exist or column doesn't exist, skip
        if (columnInfo.length === 0) {
            return;
        }

        // Step 1: Add new UUID column
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            ADD COLUMN IF NOT EXISTS "agent_uuid" uuid
        `);

        // Step 2: Populate the new column by looking up agent.id from agent.agent_id
        await queryRunner.query(`
            UPDATE "core"."sponsor_configuration" sc
            SET "agent_uuid" = a."id"
            FROM "core"."agent" a
            WHERE sc."agent_id"::text = a."agent_id"::text
        `);

        // Step 3: Delete orphaned records (where no matching agent was found)
        await queryRunner.query(`
            DELETE FROM "core"."sponsor_configuration"
            WHERE "agent_uuid" IS NULL
        `);

        // Step 4: Drop the old primary key constraint
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            DROP CONSTRAINT IF EXISTS "PK_sponsor_configuration"
        `);
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            DROP CONSTRAINT IF EXISTS "sponsor_configuration_pkey"
        `);

        // Step 5: Drop the old agent_id column
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            DROP COLUMN "agent_id"
        `);

        // Step 6: Rename agent_uuid to agent_id
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            RENAME COLUMN "agent_uuid" TO "agent_id"
        `);

        // Step 7: Make the new column NOT NULL
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            ALTER COLUMN "agent_id" SET NOT NULL
        `);

        // Step 8: Create the new primary key (agent_id)
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            ADD CONSTRAINT "PK_sponsor_configuration" PRIMARY KEY ("agent_id")
        `);

        // Step 9: Add foreign key constraint to agent.id (UUID)
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            ADD CONSTRAINT "FK_sponsor_configuration_agent" 
            FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ============================================
        // REVERT SPONSOR_CONFIGURATION TABLE
        // ============================================
        await this.revertSponsorConfiguration(queryRunner);

        // ============================================
        // REVERT ACTIVE_LOCATION TABLE
        // ============================================
        await this.revertActiveLocation(queryRunner);
    }

    private async revertActiveLocation(queryRunner: QueryRunner): Promise<void> {
        // Check if we need to revert (agent_id should be uuid)
        const columnInfo = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_schema = 'core' 
            AND table_name = 'active_location' 
            AND column_name = 'agent_id'
        `);
        
        // If agent_id is not uuid, nothing to revert
        if (columnInfo.length === 0 || columnInfo[0].data_type !== 'uuid') {
            return;
        }

        // Drop the index
        await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_active_location_agent_id"`);

        // Drop foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            DROP CONSTRAINT IF EXISTS "FK_active_location_agent"
        `);

        // Drop primary key
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            DROP CONSTRAINT IF EXISTS "PK_active_location"
        `);

        // Rename agent_id to agent_uuid temporarily
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            RENAME COLUMN "agent_id" TO "agent_uuid"
        `);

        // Add back the bigint agent_id column
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            ADD COLUMN "agent_id" bigint
        `);

        // Populate from agent.agent_id
        await queryRunner.query(`
            UPDATE "core"."active_location" al
            SET "agent_id" = a."agent_id"
            FROM "core"."agent" a
            WHERE al."agent_uuid" = a."id"
        `);

        // Make NOT NULL
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            ALTER COLUMN "agent_id" SET NOT NULL
        `);

        // Drop the UUID column
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            DROP COLUMN "agent_uuid"
        `);

        // Recreate composite primary key
        await queryRunner.query(`
            ALTER TABLE "core"."active_location" 
            ADD CONSTRAINT "PK_active_location" PRIMARY KEY ("name", "agent_id")
        `);
    }

    private async revertSponsorConfiguration(queryRunner: QueryRunner): Promise<void> {
        // Check if we need to revert (agent_id should be uuid)
        const columnInfo = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_schema = 'core' 
            AND table_name = 'sponsor_configuration' 
            AND column_name = 'agent_id'
        `);
        
        // If agent_id is not uuid, nothing to revert
        if (columnInfo.length === 0 || columnInfo[0].data_type !== 'uuid') {
            return;
        }

        // Drop foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            DROP CONSTRAINT IF EXISTS "FK_sponsor_configuration_agent"
        `);

        // Drop primary key
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            DROP CONSTRAINT IF EXISTS "PK_sponsor_configuration"
        `);

        // Rename agent_id to agent_uuid temporarily
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            RENAME COLUMN "agent_id" TO "agent_uuid"
        `);

        // Add back the bigint agent_id column
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            ADD COLUMN "agent_id" bigint
        `);

        // Populate from agent.agent_id
        await queryRunner.query(`
            UPDATE "core"."sponsor_configuration" sc
            SET "agent_id" = a."agent_id"
            FROM "core"."agent" a
            WHERE sc."agent_uuid" = a."id"
        `);

        // Make NOT NULL
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            ALTER COLUMN "agent_id" SET NOT NULL
        `);

        // Drop the UUID column
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            DROP COLUMN "agent_uuid"
        `);

        // Recreate primary key
        await queryRunner.query(`
            ALTER TABLE "core"."sponsor_configuration" 
            ADD CONSTRAINT "PK_sponsor_configuration" PRIMARY KEY ("agent_id")
        `);
    }
}
