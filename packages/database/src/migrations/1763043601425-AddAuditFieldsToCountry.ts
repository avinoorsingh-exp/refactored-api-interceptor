import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditFieldsToCountry1763043601425 implements MigrationInterface {
    name = 'AddAuditFieldsToCountry1763043601425'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."country" DROP CONSTRAINT "PK_220fe368500f103cf873b01f159"`);
        await queryRunner.query(`ALTER TABLE "core"."country" DROP COLUMN "country_id"`);
        await queryRunner.query(`ALTER TABLE "core"."country" ADD "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."country" ADD "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "core"."country" ADD "modified_by" text NOT NULL DEFAULT 'system'`);
        await queryRunner.query(`ALTER TABLE "core"."country" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "core"."country" ADD CONSTRAINT "PK_bf6e37c231c4f4ea56dcd887269" PRIMARY KEY ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."country" DROP CONSTRAINT "PK_bf6e37c231c4f4ea56dcd887269"`);
        await queryRunner.query(`ALTER TABLE "core"."country" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "core"."country" DROP COLUMN "modified_by"`);
        await queryRunner.query(`ALTER TABLE "core"."country" DROP COLUMN "last_modified"`);
        await queryRunner.query(`ALTER TABLE "core"."country" DROP COLUMN "created"`);
        await queryRunner.query(`ALTER TABLE "core"."country" ADD "country_id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "core"."country" ADD CONSTRAINT "PK_220fe368500f103cf873b01f159" PRIMARY KEY ("country_id")`);
    }

}
