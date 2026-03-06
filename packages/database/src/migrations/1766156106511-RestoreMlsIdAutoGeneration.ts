import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to restore auto-generation on MLS.id column.
 * 
 * Problem:
 * The migration 1765813354156-AddEntityFieldsAndRelationships incorrectly dropped
 * the DEFAULT on mls.id, breaking auto-generation of IDs.
 * 
 * Fix:
 * 1. Check which sequence exists (mls_mlsId_seq from original BIGSERIAL, or mls_id_seq)
 * 2. Restore the DEFAULT nextval(...) on the id column
 * 3. Sync the sequence to current max id + 1
 */
export class RestoreMlsIdAutoGeneration1766156106511 implements MigrationInterface {
    name = 'RestoreMlsIdAutoGeneration1766156106511'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if the original sequence exists (from BIGSERIAL - named mls_mlsId_seq)
        const originalSeq = await queryRunner.query(`
            SELECT sequencename FROM pg_sequences 
            WHERE schemaname = 'core' AND sequencename = 'mls_mlsId_seq'
        `);

        // Check if the newer sequence exists (mls_id_seq)
        const newSeq = await queryRunner.query(`
            SELECT sequencename FROM pg_sequences 
            WHERE schemaname = 'core' AND sequencename = 'mls_id_seq'
        `);

        let sequenceName: string;

        if (newSeq.length > 0) {
            // Use the newer sequence
            sequenceName = '"core"."mls_id_seq"';
        } else if (originalSeq.length > 0) {
            // Use the original BIGSERIAL sequence
            sequenceName = '"core"."mls_mlsId_seq"';
        } else {
            // Create a new sequence if neither exists
            await queryRunner.query(`
                CREATE SEQUENCE "core"."mls_id_seq" AS bigint
            `);
            sequenceName = '"core"."mls_id_seq"';
        }

        // Restore the default value on the id column
        await queryRunner.query(`
            ALTER TABLE "core"."mls" 
            ALTER COLUMN "id" SET DEFAULT nextval('${sequenceName}')
        `);

        // Ensure sequence is owned by the column (for proper cleanup on table drop)
        await queryRunner.query(`
            ALTER SEQUENCE ${sequenceName} OWNED BY "core"."mls"."id"
        `);

        // Sync sequence to current max value + 1 (in case of existing data)
        await queryRunner.query(`
            SELECT setval('${sequenceName}', COALESCE((SELECT MAX(id) FROM "core"."mls"), 0) + 1, false)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: drop the default (restores the broken state)
        await queryRunner.query(`
            ALTER TABLE "core"."mls" ALTER COLUMN "id" DROP DEFAULT
        `);
    }
}
