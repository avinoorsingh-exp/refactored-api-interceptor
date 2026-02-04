import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add RETRYING status to kafka_message_status enum.
 *
 * Purpose:
 * - Add RETRYING as a transitional state for messages being retried
 * - Separates retry-in-progress from terminal ERROR state
 * - Enables deterministic UI rendering without flicker
 *
 * Changes:
 * - Adds RETRYING to the enum type: SENT, PROCESSED, ERROR, RETRYING
 * - No data migration needed (RETRYING is new, no existing records use it)
 */
export class AddRetryingStatusToKafkaMessageStatusEnum1770400000000 implements MigrationInterface {
	name = 'AddRetryingStatusToKafkaMessageStatusEnum1770400000000';

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

		// Check if enum already has RETRYING value (migration already applied)
		const enumValues = await queryRunner.query(`
			SELECT unnest(enum_range(NULL::core.kafka_message_status))::text AS value
		`).catch(() => []);

		const hasRetrying = enumValues.some((row: { value: string }) => row.value === 'RETRYING');
		if (hasRetrying) {
			// Migration already applied - enum already has RETRYING
			return;
		}

		// Add RETRYING to the existing enum type
		// PostgreSQL allows adding values to enums without recreating the type
		await queryRunner.query(`
			ALTER TYPE core.kafka_message_status ADD VALUE IF NOT EXISTS 'RETRYING'
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

		// Check if enum has RETRYING value
		const enumValues = await queryRunner.query(`
			SELECT unnest(enum_range(NULL::core.kafka_message_status))::text AS value
		`).catch(() => []);

		const hasRetrying = enumValues.some((row: { value: string }) => row.value === 'RETRYING');
		if (!hasRetrying) {
			// Already reverted - enum doesn't have RETRYING
			return;
		}

		// Check if any records use RETRYING status
		const retryingRecords = await queryRunner.query(`
			SELECT COUNT(*) as count
			FROM core.kafka_message_processing
			WHERE status = 'RETRYING'
		`);

		const retryingCount = parseInt(retryingRecords[0]?.count || '0', 10);
		if (retryingCount > 0) {
			// Update RETRYING records to ERROR before removing the enum value
			// This is safe because RETRYING indicates a retry in progress that failed
			await queryRunner.query(`
				UPDATE core.kafka_message_processing
				SET status = 'ERROR'
				WHERE status = 'RETRYING'
			`);
		}

		// Note: PostgreSQL does not support removing enum values directly
		// To fully revert, we would need to:
		// 1. Convert column to text
		// 2. Drop enum type
		// 3. Recreate enum without RETRYING
		// 4. Convert column back to enum
		// 
		// However, since this is a destructive operation and RETRYING is a new value,
		// we'll leave the enum value in place for safety. If needed, a manual migration
		// can be performed to remove it.
		//
		// For now, we just update any RETRYING records to ERROR (done above)
	}
}

