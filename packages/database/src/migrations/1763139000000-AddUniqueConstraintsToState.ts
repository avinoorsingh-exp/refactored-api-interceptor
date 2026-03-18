import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintsToState1763139000000 implements MigrationInterface {
    name = 'AddUniqueConstraintsToState1763139000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add unique constraint to state name
        await queryRunner.query(`ALTER TABLE "core"."state" ADD CONSTRAINT "UQ_state_name" UNIQUE ("name")`);

        // Add unique constraint to state code
        await queryRunner.query(`ALTER TABLE "core"."state" ADD CONSTRAINT "UQ_state_code" UNIQUE ("code")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove unique constraint from state code
        await queryRunner.query(`ALTER TABLE "core"."state" DROP CONSTRAINT "UQ_state_code"`);

        // Remove unique constraint from state name
        await queryRunner.query(`ALTER TABLE "core"."state" DROP CONSTRAINT "UQ_state_name"`);
    }
}
