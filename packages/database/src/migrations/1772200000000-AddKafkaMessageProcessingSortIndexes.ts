import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds recommended indexes on core.kafka_message_processing for list and filter+sort queries.
 *
 * 1. (last_attempt_at DESC NULLS LAST, created_at DESC) — supports the default findPage sort
 *    so the "recent activity" list avoids full table scans.
 * 2. (status, last_attempt_at DESC NULLS LAST) — supports filtering by status (e.g. ERROR)
 *    and sorting by recency (dashboards, error views).
 */
export class AddKafkaMessageProcessingSortIndexes1772200000000 implements MigrationInterface {
	name = 'AddKafkaMessageProcessingSortIndexes1772200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_last_attempt_created_at"
			ON "core"."kafka_message_processing" ("last_attempt_at" DESC NULLS LAST, "created_at" DESC)
		`);
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_status_last_attempt_at"
			ON "core"."kafka_message_processing" ("status", "last_attempt_at" DESC NULLS LAST)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_status_last_attempt_at"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_last_attempt_created_at"
		`);
	}
}
