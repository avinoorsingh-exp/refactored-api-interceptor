import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Update kafka_message_status enum to replace RECEIVED with SENT.
 *
 * Purpose:
 * - Change status flow: Producer creates SENT records, Consumer updates to PROCESSED/ERROR
 * - Remove RECEIVED status (no longer needed)
 * - Add SENT status for tracking successfully produced messages
 *
 * Changes:
 * - Drops and recreates the enum type with new values: SENT, PROCESSED, ERROR
 * - Updates existing RECEIVED records to SENT (assuming they were sent but not yet processed)
 */
export class UpdateKafkaMessageStatusEnum1769000000001 implements MigrationInterface {
	name = 'UpdateKafkaMessageStatusEnum1769000000001';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if table exists (migration should be idempotent)
		const tableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_message_processing'
		`);

		if (tableExists.length === 0) {
			// Table doesn't exist yet - skip this migration
			// The CreateKafkaMessageProcessingTable migration will create it with the correct enum
			return;
		}

		// Check if enum already has SENT value (migration already applied)
		const enumValues = await queryRunner.query(`
			SELECT unnest(enum_range(NULL::core.kafka_message_status))::text AS value
		`).catch(() => []);

		const hasSent = enumValues.some((row: { value: string }) => row.value === 'SENT');
		if (hasSent) {
			// Migration already applied - enum already has SENT
			return;
		}

		// Step 1: Drop the default value (it depends on the enum type)
		// Use IF EXISTS pattern - check if default exists first
		const hasDefault = await queryRunner.query(`
			SELECT column_default 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_message_processing' 
			AND column_name = 'status'
		`);

		if (hasDefault.length > 0 && hasDefault[0].column_default) {
			await queryRunner.query(`
				ALTER TABLE core.kafka_message_processing
				ALTER COLUMN status DROP DEFAULT
			`);
		}

		// Step 2: Convert column to text temporarily so we can update values
		// Check current type first
		const columnInfo = await queryRunner.query(`
			SELECT data_type 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_message_processing' 
			AND column_name = 'status'
		`);

		if (columnInfo.length > 0 && columnInfo[0].data_type !== 'text') {
			await queryRunner.query(`
				ALTER TABLE core.kafka_message_processing
				ALTER COLUMN status TYPE text
				USING status::text
			`);
		}

		// Step 3: Update any existing RECEIVED records to SENT
		// (assuming they were sent but not yet processed)
		await queryRunner.query(`
			UPDATE core.kafka_message_processing
			SET status = 'SENT'
			WHERE status = 'RECEIVED'
		`);

		// Step 4: Drop the old enum type (now safe since column is text and default is dropped)
		await queryRunner.query(`
			DROP TYPE IF EXISTS core.kafka_message_status
		`);

		// Step 5: Create the new enum type with SENT, PROCESSED, ERROR
		await queryRunner.query(`
			CREATE TYPE core.kafka_message_status AS ENUM ('SENT', 'PROCESSED', 'ERROR')
		`);

		// Step 6: Change the column back to the enum type
		await queryRunner.query(`
			ALTER TABLE core.kafka_message_processing
			ALTER COLUMN status TYPE core.kafka_message_status
			USING status::core.kafka_message_status
		`);

		// Step 7: Set default to SENT (for new records created by producer)
		await queryRunner.query(`
			ALTER TABLE core.kafka_message_processing
			ALTER COLUMN status SET DEFAULT 'SENT'::core.kafka_message_status
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Check if table exists
		const tableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_message_processing'
		`);

		if (tableExists.length === 0) {
			// Table doesn't exist - nothing to revert
			return;
		}

		// Check if enum has RECEIVED value (already reverted)
		const enumValues = await queryRunner.query(`
			SELECT unnest(enum_range(NULL::core.kafka_message_status))::text AS value
		`).catch(() => []);

		const hasReceived = enumValues.some((row: { value: string }) => row.value === 'RECEIVED');
		if (hasReceived) {
			// Already reverted - enum already has RECEIVED
			return;
		}

		// Step 1: Drop the default value (it depends on the enum type)
		const hasDefault = await queryRunner.query(`
			SELECT column_default 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_message_processing' 
			AND column_name = 'status'
		`);

		if (hasDefault.length > 0 && hasDefault[0].column_default) {
			await queryRunner.query(`
				ALTER TABLE core.kafka_message_processing
				ALTER COLUMN status DROP DEFAULT
			`);
		}

		// Step 2: Convert column to text temporarily
		const columnInfo = await queryRunner.query(`
			SELECT data_type 
			FROM information_schema.columns 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_message_processing' 
			AND column_name = 'status'
		`);

		if (columnInfo.length > 0 && columnInfo[0].data_type !== 'text') {
			await queryRunner.query(`
				ALTER TABLE core.kafka_message_processing
				ALTER COLUMN status TYPE text
				USING status::text
			`);
		}

		// Step 3: Update SENT records back to RECEIVED
		await queryRunner.query(`
			UPDATE core.kafka_message_processing
			SET status = 'RECEIVED'
			WHERE status = 'SENT'
		`);

		// Step 4: Drop the new enum type (now safe since column is text and default is dropped)
		await queryRunner.query(`
			DROP TYPE IF EXISTS core.kafka_message_status
		`);

		// Step 5: Recreate the old enum type with RECEIVED, PROCESSED, ERROR
		await queryRunner.query(`
			CREATE TYPE core.kafka_message_status AS ENUM ('RECEIVED', 'PROCESSED', 'ERROR')
		`);

		// Step 6: Change column back to enum type
		await queryRunner.query(`
			ALTER TABLE core.kafka_message_processing
			ALTER COLUMN status TYPE core.kafka_message_status
			USING status::core.kafka_message_status
		`);

		// Step 7: Set default back to RECEIVED
		await queryRunner.query(`
			ALTER TABLE core.kafka_message_processing
			ALTER COLUMN status SET DEFAULT 'RECEIVED'::core.kafka_message_status
		`);
	}
}

