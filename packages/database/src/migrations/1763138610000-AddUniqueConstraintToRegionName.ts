import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintToRegionName1763138610000 implements MigrationInterface {
    name = 'AddUniqueConstraintToRegionName1763138610000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add unique constraint to region name
        await queryRunner.query(`ALTER TABLE "core"."region" ADD CONSTRAINT "UQ_region_name" UNIQUE ("name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove unique constraint from region name
        await queryRunner.query(`ALTER TABLE "core"."region" DROP CONSTRAINT "UQ_region_name"`);
    }
}
