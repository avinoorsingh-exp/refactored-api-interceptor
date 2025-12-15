import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add unique constraints and fix MLS entity structure.
 * 
 * Changes:
 * - Add unique constraint on office.name
 * - Add unique constraint on pay_plan.name
 * - Add unique constraint on mls.global_id
 * - Rename mls.mlsId to mls.id
 * - Rename mls.larversion_url to mls.kunversion_url
 * - Add mls.created column
 * 
 * This migration includes scripts to remove duplicates before adding unique constraints.
 */
export class AddUniqueConstraintsAndFixMLS1763139300000 implements MigrationInterface {
    name = 'AddUniqueConstraintsAndFixMLS1763139300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // =====================================================
        // STEP 1: Remove duplicate office names (keep first/oldest)
        // =====================================================
        await queryRunner.query(`
            DELETE FROM "core"."office" o1
            USING "core"."office" o2
            WHERE o1.id > o2.id
            AND LOWER(TRIM(o1.name)) = LOWER(TRIM(o2.name))
        `);

        // Trim whitespace from office names
        await queryRunner.query(`
            UPDATE "core"."office"
            SET name = TRIM(name)
            WHERE name != TRIM(name)
        `);

        // Add unique constraint on office.name
        await queryRunner.query(`
            ALTER TABLE "core"."office"
            ADD CONSTRAINT "UQ_office_name" UNIQUE ("name")
        `);

        // =====================================================
        // STEP 2: Remove duplicate pay_plan names (keep first/oldest)
        // =====================================================
        await queryRunner.query(`
            DELETE FROM "core"."pay_plan" p1
            USING "core"."pay_plan" p2
            WHERE p1.id > p2.id
            AND LOWER(TRIM(p1.name)) = LOWER(TRIM(p2.name))
        `);

        // Trim whitespace from pay_plan names
        await queryRunner.query(`
            UPDATE "core"."pay_plan"
            SET name = TRIM(name)
            WHERE name != TRIM(name)
        `);

        // Add unique constraint on pay_plan.name
        await queryRunner.query(`
            ALTER TABLE "core"."pay_plan"
            ADD CONSTRAINT "UQ_pay_plan_name" UNIQUE ("name")
        `);

        // =====================================================
        // STEP 3: Fix MLS table structure
        // =====================================================
        
        // Rename mlsId column to id (if it exists as mlsId)
        const mlsIdColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'core' AND table_name = 'mls' AND column_name = 'mlsId'
        `);
        
        if (mlsIdColumn.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "core"."mls" RENAME COLUMN "mlsId" TO "id"
            `);
        }

        // Rename larversion_url to kunversion_url (if it exists)
        const larversionColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'core' AND table_name = 'mls' AND column_name = 'larversion_url'
        `);
        
        if (larversionColumn.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "core"."mls" RENAME COLUMN "larversion_url" TO "kunversion_url"
            `);
        }

        // Add created column if it doesn't exist
        const createdColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'core' AND table_name = 'mls' AND column_name = 'created'
        `);
        
        if (createdColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "core"."mls"
                ADD COLUMN "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            `);
        }

        // =====================================================
        // STEP 4: Add unique constraint on mls.global_id
        // =====================================================
        
        // Remove duplicate global_ids (keep first/oldest, excluding nulls)
        await queryRunner.query(`
            DELETE FROM "core"."mls" m1
            USING "core"."mls" m2
            WHERE m1.id > m2.id
            AND m1.global_id IS NOT NULL
            AND m1.global_id = m2.global_id
        `);

        // Add unique constraint on mls.global_id
        await queryRunner.query(`
            ALTER TABLE "core"."mls"
            ADD CONSTRAINT "UQ_mls_global_id" UNIQUE ("global_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove unique constraint from mls.global_id
        await queryRunner.query(`
            ALTER TABLE "core"."mls"
            DROP CONSTRAINT IF EXISTS "UQ_mls_global_id"
        `);

        // Remove created column from mls
        await queryRunner.query(`
            ALTER TABLE "core"."mls"
            DROP COLUMN IF EXISTS "created"
        `);

        // Rename kunversion_url back to larversion_url
        const kunversionColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'core' AND table_name = 'mls' AND column_name = 'kunversion_url'
        `);
        
        if (kunversionColumn.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "core"."mls" RENAME COLUMN "kunversion_url" TO "larversion_url"
            `);
        }

        // Rename id back to mlsId
        const idColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'core' AND table_name = 'mls' AND column_name = 'id'
        `);
        
        if (idColumn.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "core"."mls" RENAME COLUMN "id" TO "mlsId"
            `);
        }

        // Remove unique constraint from pay_plan.name
        await queryRunner.query(`
            ALTER TABLE "core"."pay_plan"
            DROP CONSTRAINT IF EXISTS "UQ_pay_plan_name"
        `);

        // Remove unique constraint from office.name
        await queryRunner.query(`
            ALTER TABLE "core"."office"
            DROP CONSTRAINT IF EXISTS "UQ_office_name"
        `);
    }
}
