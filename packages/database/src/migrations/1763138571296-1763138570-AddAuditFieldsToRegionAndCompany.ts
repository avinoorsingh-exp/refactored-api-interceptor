import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditFieldsToRegionAndCompany1763138571296 implements MigrationInterface {
    name = 'AddAuditFieldsToRegionAndCompany1763138571296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD "modified_by" text NOT NULL DEFAULT 'system'`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD "modified_by" text NOT NULL DEFAULT 'system'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN "modified_by"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN "last_modified"`);
        await queryRunner.query(`ALTER TABLE "core"."region" DROP COLUMN "created"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN "modified_by"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN "last_modified"`);
        await queryRunner.query(`ALTER TABLE "core"."company" DROP COLUMN "created"`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."region" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."company" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

}
