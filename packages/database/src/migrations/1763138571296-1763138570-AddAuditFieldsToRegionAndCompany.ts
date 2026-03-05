import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditFieldsToRegionAndCompany1763138571296 implements MigrationInterface {
    name = 'AddAuditFieldsToRegionAndCompany1763138571296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop old timestamp columns if they exist (for tables that had them)
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN IF EXISTS "created_at"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN IF EXISTS "updated_at"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN IF EXISTS "created_at"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN IF EXISTS "updated_at"`);
        
        // Add new audit columns if they don't exist
        await queryRunner.query(`ALTER TABLE "core"."company" ADD COLUMN IF NOT EXISTS "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD COLUMN IF NOT EXISTS "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD COLUMN IF NOT EXISTS "modified_by" text NOT NULL DEFAULT 'system'`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD COLUMN IF NOT EXISTS "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD COLUMN IF NOT EXISTS "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD COLUMN IF NOT EXISTS "modified_by" text NOT NULL DEFAULT 'system'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop new audit columns if they exist
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN IF EXISTS "modified_by"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN IF EXISTS "last_modified"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN IF EXISTS "created"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN IF EXISTS "modified_by"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN IF EXISTS "last_modified"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN IF EXISTS "created"`);
        
        // Restore old timestamp columns if they don't exist
        await queryRunner.query(`ALTER TABLE "core"."region" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

}
