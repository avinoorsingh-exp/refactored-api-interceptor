import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add auto-generation for agent.agent_id column and
 * set default lifecycle_status to 'joining'.
 *
 * For agent_id:
 * - Creates a sequence and sets it as the default value
 * - If a value is provided during INSERT, it will be used; otherwise auto-generated
 * - Populates NULL agent_id values for existing agents
 *
 * For lifecycle_status:
 * - Sets default to 'joining'
 * - Populates NULL values with 'joining'
 * - Makes column NOT NULL
 */
export class AddAgentIdAutoGeneration1765910000000 implements MigrationInterface {
    name = 'AddAgentIdAutoGeneration1765910000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ============================================
        // AGENT_ID AUTO-GENERATION
        // ============================================

        // Step 1: Create sequence for agent_id generation (idempotent)
        await queryRunner.query(`
            CREATE SEQUENCE IF NOT EXISTS "core"."agent_agent_id_seq"
            AS bigint
            START WITH 1
            INCREMENT BY 1
            NO MINVALUE
            NO MAXVALUE
            CACHE 1
        `);

        // Step 2: Find the max existing agent_id and set sequence to start after it
        const result = await queryRunner.query(`
            SELECT COALESCE(MAX(agent_id), 0) as max_id FROM "core"."agent" WHERE agent_id IS NOT NULL
        `);
        const maxId = BigInt(result[0]?.max_id || 0);
        
        // Get current sequence value
        const seqResult = await queryRunner.query(`
            SELECT last_value FROM "core"."agent_agent_id_seq"
        `);
        const currentSeqVal = BigInt(seqResult[0]?.last_value || 0);
        
        // Only update sequence if max existing id is higher than current sequence value
        if (maxId >= currentSeqVal) {
            await queryRunner.query(`
                SELECT setval('"core"."agent_agent_id_seq"', ${maxId + BigInt(1)}, false)
            `);
        }

        // Step 3: Set default value for agent_id column to use the sequence (idempotent)
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "agent_id" SET DEFAULT nextval('"core"."agent_agent_id_seq"')
        `);

        // Step 4: Populate NULL agent_id values for existing agents
        await queryRunner.query(`
            UPDATE "core"."agent"
            SET "agent_id" = nextval('"core"."agent_agent_id_seq"')
            WHERE "agent_id" IS NULL
        `);

        // Step 5: Make agent_id NOT NULL now that all rows have values
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "agent_id" SET NOT NULL
        `);

        // ============================================
        // LIFECYCLE_STATUS DEFAULT
        // ============================================

        // Step 6: Set default value for lifecycle_status
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "lifecycle_status" SET DEFAULT 'joining'
        `);

        // Step 7: Populate NULL lifecycle_status values
        await queryRunner.query(`
            UPDATE "core"."agent"
            SET "lifecycle_status" = 'joining'
            WHERE "lifecycle_status" IS NULL
        `);

        // Step 8: Make lifecycle_status NOT NULL
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "lifecycle_status" SET NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ============================================
        // LIFECYCLE_STATUS ROLLBACK
        // ============================================

        // Step 1: Make lifecycle_status nullable again
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "lifecycle_status" DROP NOT NULL
        `);

        // Step 2: Remove default value for lifecycle_status
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "lifecycle_status" DROP DEFAULT
        `);

        // ============================================
        // AGENT_ID ROLLBACK
        // ============================================

        // Step 3: Make agent_id nullable again
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "agent_id" DROP NOT NULL
        `);

        // Step 4: Remove default value
        await queryRunner.query(`
            ALTER TABLE "core"."agent"
            ALTER COLUMN "agent_id" DROP DEFAULT
        `);

        // Step 5: Drop the sequence
        await queryRunner.query(`
            DROP SEQUENCE IF EXISTS "core"."agent_agent_id_seq"
        `);
    }
}
