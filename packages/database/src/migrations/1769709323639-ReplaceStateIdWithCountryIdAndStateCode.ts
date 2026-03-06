import { MigrationInterface, QueryRunner } from 'typeorm'

export class ReplaceStateIdWithCountryIdAndStateCode1769709323639 implements MigrationInterface {
	name = 'ReplaceStateIdWithCountryIdAndStateCode1769709323639'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ========================================
		// STEP 1: Add unique constraint on state table for composite lookup
		// ========================================

		// Check if constraint exists
		const stateConstraintExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'uk_state_country_code'
		`)

		if (stateConstraintExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE core.state
				ADD CONSTRAINT uk_state_country_code
				UNIQUE (country_id, code)
			`)
		}

		// ========================================
		// STEP 2: Add new columns to address table
		// ========================================

		// Check if country_id column exists
		const addressCountryIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'address'
			AND column_name = 'country_id'
		`)

		if (addressCountryIdExists.length === 0) {
			// Add country_id column (nullable initially for data migration)
			await queryRunner.query(`
				ALTER TABLE core.address
				ADD COLUMN country_id INTEGER
			`)
		}

		// Check if state_code column exists
		const addressStateCodeExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'address'
			AND column_name = 'state_code'
		`)

		if (addressStateCodeExists.length === 0) {
			// Add state_code column
			await queryRunner.query(`
				ALTER TABLE core.address
				ADD COLUMN state_code VARCHAR(2)
			`)
		}

		// ========================================
		// STEP 3: Add new columns to license table
		// ========================================

		// Check if country_id column exists
		const licenseCountryIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'country_id'
		`)

		if (licenseCountryIdExists.length === 0) {
			// Add country_id column (nullable initially for data migration)
			await queryRunner.query(`
				ALTER TABLE core.license
				ADD COLUMN country_id INTEGER
			`)
		}

		// Check if state_code column exists
		const licenseStateCodeExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'state_code'
		`)

		if (licenseStateCodeExists.length === 0) {
			// Add state_code column
			await queryRunner.query(`
				ALTER TABLE core.license
				ADD COLUMN state_code VARCHAR(2)
			`)
		}

		// ========================================
		// STEP 4: Migrate data for address table
		// ========================================

		// Populate country_id and state_code from existing state_id
		await queryRunner.query(`
			UPDATE core.address a
			SET
				country_id = s.country_id,
				state_code = s.code
			FROM core.state s
			WHERE a.state_id = s.id
			AND a.country_id IS NULL
		`)

		// Handle addresses without state (international) - default to US (id=1)
		await queryRunner.query(`
			UPDATE core.address
			SET country_id = 1
			WHERE state_id IS NULL
			AND country_id IS NULL
		`)

		// ========================================
		// STEP 5: Migrate data for license table
		// ========================================

		// Populate country_id and state_code from existing state_id
		await queryRunner.query(`
			UPDATE core.license l
			SET
				country_id = s.country_id,
				state_code = s.code
			FROM core.state s
			WHERE l.state_id = s.id
			AND l.country_id IS NULL
		`)

		// ========================================
		// STEP 6: Create country_program table
		// ========================================

		const countryProgramTableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'country_program'
		`)

		if (countryProgramTableExists.length === 0) {
			await queryRunner.query(`
				CREATE TABLE core.country_program (
					country_id INTEGER NOT NULL,
					program_id BIGINT NOT NULL,
					allowed BOOLEAN DEFAULT TRUE,
					PRIMARY KEY (country_id, program_id)
				)
			`)

			// Add foreign key constraints
			await queryRunner.query(`
				ALTER TABLE core.country_program
				ADD CONSTRAINT fk_country_program_country
				FOREIGN KEY (country_id) REFERENCES core.country(id) ON DELETE CASCADE
			`)

			await queryRunner.query(`
				ALTER TABLE core.country_program
				ADD CONSTRAINT fk_country_program_program
				FOREIGN KEY (program_id) REFERENCES core.program(id) ON DELETE CASCADE
			`)

			// Migrate data from state_program
			await queryRunner.query(`
				INSERT INTO core.country_program (country_id, program_id, allowed)
				SELECT DISTINCT s.country_id, sp.program_id, sp.allowed
				FROM core.state_program sp
				JOIN core.state s ON sp.state_id = s.id
				ON CONFLICT (country_id, program_id) DO NOTHING
			`)
		}

		// ========================================
		// STEP 7: Add foreign key constraints
		// ========================================

		// Add FK constraint for address.country_id
		const addressCountryFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'fk_address_country'
		`)

		if (addressCountryFkExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				ADD CONSTRAINT fk_address_country
				FOREIGN KEY (country_id) REFERENCES core.country(id)
			`)
		}

		// Add FK constraint for license.country_id
		const licenseCountryFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'fk_license_country'
		`)

		if (licenseCountryFkExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				ADD CONSTRAINT fk_license_country
				FOREIGN KEY (country_id) REFERENCES core.country(id)
			`)
		}

		// ========================================
		// STEP 8: Make country_id NOT NULL after data migration
		// ========================================

		await queryRunner.query(`
			ALTER TABLE core.address
			ALTER COLUMN country_id SET NOT NULL
		`)

		await queryRunner.query(`
			ALTER TABLE core.license
			ALTER COLUMN country_id SET NOT NULL
		`)

		// ========================================
		// STEP 9: Add composite indexes for performance
		// ========================================

		const addressCompositeIndexExists = await queryRunner.query(`
			SELECT 1 FROM pg_indexes
			WHERE schemaname = 'core'
			AND tablename = 'address'
			AND indexname = 'idx_address_country_state'
		`)

		if (addressCompositeIndexExists.length === 0) {
			await queryRunner.query(`
				CREATE INDEX idx_address_country_state
				ON core.address(country_id, state_code)
			`)
		}

		const licenseCompositeIndexExists = await queryRunner.query(`
			SELECT 1 FROM pg_indexes
			WHERE schemaname = 'core'
			AND tablename = 'license'
			AND indexname = 'idx_license_country_state'
		`)

		if (licenseCompositeIndexExists.length === 0) {
			await queryRunner.query(`
				CREATE INDEX idx_license_country_state
				ON core.license(country_id, state_code)
			`)
		}

		// ========================================
		// STEP 10: Drop old columns and constraints
		// ========================================

		// Drop FK constraint on address.state_id
		const addressStateFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND table_name = 'address'
			AND constraint_name = 'FK_address_state_id'
		`)

		if (addressStateFkExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				DROP CONSTRAINT "FK_address_state_id"
			`)
		}

		// Drop FK constraint on license.state_id
		const licenseStateFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND table_name = 'license'
			AND constraint_name = 'FK_license_state_id'
		`)

		if (licenseStateFkExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				DROP CONSTRAINT "FK_license_state_id"
			`)
		}

		// Drop old state_id columns
		const addressStateIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'address'
			AND column_name = 'state_id'
		`)

		if (addressStateIdExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				DROP COLUMN state_id
			`)
		}

		const licenseStateIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'state_id'
		`)

		if (licenseStateIdExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				DROP COLUMN state_id
			`)
		}

		// Drop old state_program table
		const stateProgramTableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'state_program'
		`)

		if (stateProgramTableExists.length > 0) {
			await queryRunner.query(`
				DROP TABLE core.state_program
			`)
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// ========================================
		// STEP 1: Recreate state_id columns
		// ========================================

		// Add state_id back to address
		const addressStateIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'address'
			AND column_name = 'state_id'
		`)

		if (addressStateIdExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				ADD COLUMN state_id UUID
			`)
		}

		// Add state_id back to license
		const licenseStateIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'state_id'
		`)

		if (licenseStateIdExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				ADD COLUMN state_id UUID
			`)
		}

		// ========================================
		// STEP 2: Restore data from country_id + state_code
		// ========================================

		// Restore address.state_id
		await queryRunner.query(`
			UPDATE core.address a
			SET state_id = s.id
			FROM core.state s
			WHERE a.country_id = s.country_id
			AND a.state_code = s.code
			AND a.state_id IS NULL
		`)

		// Restore license.state_id
		await queryRunner.query(`
			UPDATE core.license l
			SET state_id = s.id
			FROM core.state s
			WHERE l.country_id = s.country_id
			AND l.state_code = s.code
			AND l.state_id IS NULL
		`)

		// Make state_id NOT NULL for license (was required)
		await queryRunner.query(`
			ALTER TABLE core.license
			ALTER COLUMN state_id SET NOT NULL
		`)

		// ========================================
		// STEP 3: Recreate state_program table
		// ========================================

		const stateProgramTableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'state_program'
		`)

		if (stateProgramTableExists.length === 0) {
			await queryRunner.query(`
				CREATE TABLE core.state_program (
					state_id UUID NOT NULL,
					program_id BIGINT NOT NULL,
					allowed BOOLEAN DEFAULT TRUE,
					PRIMARY KEY (state_id, program_id)
				)
			`)

			// Add foreign key constraints
			await queryRunner.query(`
				ALTER TABLE core.state_program
				ADD CONSTRAINT fk_state_program_state
				FOREIGN KEY (state_id) REFERENCES core.state(id) ON DELETE CASCADE
			`)

			await queryRunner.query(`
				ALTER TABLE core.state_program
				ADD CONSTRAINT fk_state_program_program
				FOREIGN KEY (program_id) REFERENCES core.program(id) ON DELETE CASCADE
			`)

			// Restore data from country_program
			await queryRunner.query(`
				INSERT INTO core.state_program (state_id, program_id, allowed)
				SELECT DISTINCT s.id, cp.program_id, cp.allowed
				FROM core.country_program cp
				JOIN core.state s ON cp.country_id = s.country_id
				ON CONFLICT (state_id, program_id) DO NOTHING
			`)
		}

		// ========================================
		// STEP 4: Restore foreign key constraints
		// ========================================

		// Add FK constraint for address.state_id
		const addressStateFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'FK_address_state_id'
		`)

		if (addressStateFkExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				ADD CONSTRAINT "FK_address_state_id"
				FOREIGN KEY (state_id) REFERENCES core.state(id)
			`)
		}

		// Add FK constraint for license.state_id
		const licenseStateFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'FK_license_state_id'
		`)

		if (licenseStateFkExists.length === 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				ADD CONSTRAINT "FK_license_state_id"
				FOREIGN KEY (state_id) REFERENCES core.state(id)
			`)
		}

		// ========================================
		// STEP 5: Drop new columns and constraints
		// ========================================

		// Drop composite indexes
		await queryRunner.query(`
			DROP INDEX IF EXISTS core.idx_address_country_state
		`)

		await queryRunner.query(`
			DROP INDEX IF EXISTS core.idx_license_country_state
		`)

		// Drop FK constraints
		const addressCountryFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'fk_address_country'
		`)

		if (addressCountryFkExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				DROP CONSTRAINT fk_address_country
			`)
		}

		const licenseCountryFkExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'fk_license_country'
		`)

		if (licenseCountryFkExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				DROP CONSTRAINT fk_license_country
			`)
		}

		// Drop new columns
		const addressCountryIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'address'
			AND column_name = 'country_id'
		`)

		if (addressCountryIdExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				DROP COLUMN country_id
			`)
		}

		const addressStateCodeExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'address'
			AND column_name = 'state_code'
		`)

		if (addressStateCodeExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.address
				DROP COLUMN state_code
			`)
		}

		const licenseCountryIdExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'country_id'
		`)

		if (licenseCountryIdExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				DROP COLUMN country_id
			`)
		}

		const licenseStateCodeExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core'
			AND table_name = 'license'
			AND column_name = 'state_code'
		`)

		if (licenseStateCodeExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.license
				DROP COLUMN state_code
			`)
		}

		// Drop country_program table
		const countryProgramTableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'core'
			AND table_name = 'country_program'
		`)

		if (countryProgramTableExists.length > 0) {
			await queryRunner.query(`
				DROP TABLE core.country_program
			`)
		}

		// Drop unique constraint on state table
		const stateConstraintExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_schema = 'core'
			AND constraint_name = 'uk_state_country_code'
		`)

		if (stateConstraintExists.length > 0) {
			await queryRunner.query(`
				ALTER TABLE core.state
				DROP CONSTRAINT uk_state_country_code
			`)
		}
	}
}