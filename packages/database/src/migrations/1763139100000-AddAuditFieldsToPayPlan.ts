import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditFieldsToPayPlan1763139100000 implements MigrationInterface {
    name = 'AddAuditFieldsToPayPlan1763139100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."pay_plan" ADD "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."pay_plan" ADD "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."pay_plan" ADD "modified_by" text NOT NULL DEFAULT 'system'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."pay_plan" DROP COLUMN "modified_by"`);
        await queryRunner.query(`ALTER TABLE "core"."pay_plan" DROP COLUMN "last_modified"`);
        await queryRunner.query(`ALTER TABLE "core"."pay_plan" DROP COLUMN "created"`);
    }

}
