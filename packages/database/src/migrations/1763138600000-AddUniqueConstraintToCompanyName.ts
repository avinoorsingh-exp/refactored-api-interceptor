import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintToCompanyName1763138600000 implements MigrationInterface {
    name = 'AddUniqueConstraintToCompanyName1763138600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add unique constraint to company name
        await queryRunner.query(`ALTER TABLE "core"."company" ADD CONSTRAINT "UQ_company_name" UNIQUE ("name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove unique constraint from company name
        await queryRunner.query(`ALTER TABLE "core"."company" DROP CONSTRAINT "UQ_company_name"`);
    }
}
