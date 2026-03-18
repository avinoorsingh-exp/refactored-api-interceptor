import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to update contact_method table to use standard AuditableEntity field names
 * and add unique constraint on name.
 * 
 * Changes:
 * 1. Rename created_at → created
 * 2. Rename updated_at → last_modified
 * 3. Add modified_by column with default 'system'
 * 4. Add unique constraint on name column
 */
export class UpdateContactMethodAuditFields1765920000000 implements MigrationInterface {
	name = 'UpdateContactMethodAuditFields1765920000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if we need to rename columns (idempotent)
		const hasCreatedAt = await queryRunner.query(`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND column_name = 'created_at'
		`);

		if (hasCreatedAt.length > 0) {
			// Rename created_at to created
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				RENAME COLUMN "created_at" TO "created"
			`);
		}

		const hasUpdatedAt = await queryRunner.query(`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND column_name = 'updated_at'
		`);

		if (hasUpdatedAt.length > 0) {
			// Rename updated_at to last_modified
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				RENAME COLUMN "updated_at" TO "last_modified"
			`);
		}

		// Add modified_by column if it doesn't exist
		const hasModifiedBy = await queryRunner.query(`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND column_name = 'modified_by'
		`);

		if (hasModifiedBy.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				ADD COLUMN "modified_by" text NOT NULL DEFAULT 'system'
			`);
		}

		// Add unique constraint on name if it doesn't exist
		const hasUniqueConstraint = await queryRunner.query(`
			SELECT constraint_name 
			FROM information_schema.table_constraints 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND constraint_type = 'UNIQUE'
			  AND constraint_name LIKE '%name%'
		`);

		if (hasUniqueConstraint.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				ADD CONSTRAINT "UQ_contact_method_name" UNIQUE ("name")
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove unique constraint on name
		const hasUniqueConstraint = await queryRunner.query(`
			SELECT constraint_name 
			FROM information_schema.table_constraints 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND constraint_name = 'UQ_contact_method_name'
		`);

		if (hasUniqueConstraint.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				DROP CONSTRAINT "UQ_contact_method_name"
			`);
		}

		// Remove modified_by column
		const hasModifiedBy = await queryRunner.query(`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND column_name = 'modified_by'
		`);

		if (hasModifiedBy.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				DROP COLUMN "modified_by"
			`);
		}

		// Rename last_modified back to updated_at
		const hasLastModified = await queryRunner.query(`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND column_name = 'last_modified'
		`);

		if (hasLastModified.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				RENAME COLUMN "last_modified" TO "updated_at"
			`);
		}

		// Rename created back to created_at
		const hasCreated = await queryRunner.query(`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			  AND table_name = 'contact_method' 
			  AND column_name = 'created'
		`);

		if (hasCreated.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."contact_method" 
				RENAME COLUMN "created" TO "created_at"
			`);
		}
	}
}
