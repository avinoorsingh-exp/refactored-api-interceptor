import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Add unique constraints to contact_method table.
 * 
 * Business rules:
 * 1. Name must be unique per agent (not globally)
 * 2. Only one primary contact method per channel per agent
 * 
 * Changes:
 * - Drops global unique constraint on name (if exists)
 * - Adds composite unique index on (agent_id, name)
 * - Adds index on (agent_id, channel) for query performance
 * - Adds partial unique index on (agent_id, channel) WHERE is_primary = true
 */
export class AddContactMethodUniqueConstraints1766500000000 implements MigrationInterface {
    name = 'AddContactMethodUniqueConstraints1766500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing global unique constraint on name (if exists)
        await queryRunner.query(`
            ALTER TABLE "core"."contact_method" 
            DROP CONSTRAINT IF EXISTS "UQ_contact_method_name"
        `);
        
        // Drop any existing unique index on name column
        await queryRunner.query(`
            DROP INDEX IF EXISTS "core"."contact_method_name_key"
        `);
        
        // Add composite unique index: name unique per agent
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_contact_method_agent_name" 
            ON "core"."contact_method" ("agent_id", "name")
        `);
        
        // Add index for agent + channel queries (performance)
        await queryRunner.query(`
            CREATE INDEX "idx_contact_method_agent_channel" 
            ON "core"."contact_method" ("agent_id", "channel")
        `);
        
        // Add partial unique index: only one primary per channel per agent
        // This is a database-level safety net for the business rule
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_contact_method_agent_channel_primary" 
            ON "core"."contact_method" ("agent_id", "channel")
            WHERE "is_primary" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the partial unique index for primary
        await queryRunner.query(`
            DROP INDEX IF EXISTS "core"."idx_contact_method_agent_channel_primary"
        `);
        
        // Drop the agent + channel index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "core"."idx_contact_method_agent_channel"
        `);
        
        // Drop the composite unique index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "core"."idx_contact_method_agent_name"
        `);
        
        // Restore global unique constraint on name
        await queryRunner.query(`
            ALTER TABLE "core"."contact_method" 
            ADD CONSTRAINT "UQ_contact_method_name" UNIQUE ("name")
        `);
    }
}
