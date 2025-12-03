import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateStateAndProgramSchema1763138620000 implements MigrationInterface {
    name = 'UpdateStateAndProgramSchema1763138620000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add 'created' column to state table (state already has last_modified and modified_by)
        await queryRunner.query(`
            ALTER TABLE "core"."state" 
            ADD COLUMN IF NOT EXISTS "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        `);

        // 2. Drop existing state_program foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP CONSTRAINT IF EXISTS "FK_e7e44a9cccc1cf53b320659d265"
        `);

        // 3. Drop existing state_program primary key
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP CONSTRAINT IF EXISTS "PK_34616f86d0ce70cf7a2fa3b3a69"
        `);

        // 4. Drop the existing program_id column from state_program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP COLUMN IF EXISTS "program_id"
        `);

        // 5. Backup any existing program data
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "core"."program_backup" AS 
            SELECT * FROM "core"."program"
        `);

        // 6. Drop existing program table
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."program" CASCADE`);

        // 7. Create new program table with bigint id and new columns
        await queryRunner.query(`
            CREATE TABLE "core"."program" (
                "id" BIGSERIAL NOT NULL,
                "code" text NOT NULL,
                "name" text NOT NULL,
                "description" text,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "modified_by" text NOT NULL DEFAULT 'system',
                CONSTRAINT "PK_program_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_program_code" UNIQUE ("code")
            )
        `);

        // 8. Add program_id column to state_program as bigint
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD COLUMN "program_id" bigint NOT NULL
        `);

        // 9. Add allowed column to state_program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD COLUMN IF NOT EXISTS "allowed" boolean NOT NULL DEFAULT true
        `);

        // 10. Recreate primary key on state_program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD CONSTRAINT "PK_state_program" PRIMARY KEY ("state_id", "program_id")
        `);

        // 11. Add foreign key from state_program to program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD CONSTRAINT "FK_state_program_program" 
            FOREIGN KEY ("program_id") REFERENCES "core"."program"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // 12. Add foreign key from state_program to state
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD CONSTRAINT "FK_state_program_state" 
            FOREIGN KEY ("state_id") REFERENCES "core"."state"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // 13. Drop backup table
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."program_backup"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign keys from state_program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP CONSTRAINT IF EXISTS "FK_state_program_program"
        `);
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP CONSTRAINT IF EXISTS "FK_state_program_state"
        `);

        // Drop primary key from state_program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP CONSTRAINT IF EXISTS "PK_state_program"
        `);

        // Remove allowed column from state_program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP COLUMN IF EXISTS "allowed"
        `);

        // Remove program_id column from state_program
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            DROP COLUMN IF EXISTS "program_id"
        `);

        // Drop new program table
        await queryRunner.query(`DROP TABLE IF EXISTS "core"."program"`);

        // Recreate original program table with uuid
        await queryRunner.query(`
            CREATE TABLE "core"."program" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" text NOT NULL,
                CONSTRAINT "PK_3bade5945afbafefdd26a3a29fb" PRIMARY KEY ("id")
            )
        `);

        // Add program_id back as uuid
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD COLUMN "program_id" uuid NOT NULL
        `);

        // Recreate original primary key
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD CONSTRAINT "PK_34616f86d0ce70cf7a2fa3b3a69" PRIMARY KEY ("state_id", "program_id")
        `);

        // Recreate original foreign keys
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD CONSTRAINT "FK_a9ec7704f7c2a41971e32f37629" 
            FOREIGN KEY ("state_id") REFERENCES "core"."state"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "core"."state_program" 
            ADD CONSTRAINT "FK_e7e44a9cccc1cf53b320659d265" 
            FOREIGN KEY ("program_id") REFERENCES "core"."program"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Remove created column from state
        await queryRunner.query(`
            ALTER TABLE "core"."state" 
            DROP COLUMN IF EXISTS "created"
        `);
    }
}
