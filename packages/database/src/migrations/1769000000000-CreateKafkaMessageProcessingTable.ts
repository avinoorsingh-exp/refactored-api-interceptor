import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create kafka_message_processing table.
 *
 * Purpose:
 * - Track Kafka message processing status and metadata
 * - Support idempotency through unique constraint on (topic, partition, offset)
 * - Enable retry logic with attempt tracking
 * - Store error information for debugging and dead letter queue handling
 * - Support concurrent consumers safely
 *
 * Changes:
 * - Creates core.kafka_message_processing table with all required columns
 * - Adds unique constraint on (topic, partition, offset) for idempotency
 * - Adds indexes for common query patterns (status, consumer_group, service_name)
 * - Uses jsonb for payload and headers for efficient querying
 */
export class CreateKafkaMessageProcessingTable1769000000000 implements MigrationInterface {
	name = 'CreateKafkaMessageProcessingTable1769000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create enum type for status (PostgreSQL enum for type safety)
		await queryRunner.query(`
			CREATE TYPE core.kafka_message_status AS ENUM ('RECEIVED', 'PROCESSED', 'ERROR')
		`);

		// Create the kafka_message_processing table
		await queryRunner.query(`
			CREATE TABLE "core"."kafka_message_processing" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"topic" text NOT NULL,
				"partition" integer NOT NULL,
				"offset" bigint NOT NULL,
				"message_key" text,
				"event_id" text,
				
				"status" core.kafka_message_status NOT NULL DEFAULT 'RECEIVED',
				"attempt_count" integer NOT NULL DEFAULT 0,
				"last_attempt_at" TIMESTAMP WITH TIME ZONE,
				"processed_at" TIMESTAMP WITH TIME ZONE,
				
				"error_code" text,
				"error_message" text,
				"error_stacktrace" text,
				"is_retryable" boolean,
				"dead_lettered" boolean NOT NULL DEFAULT false,
				
				"payload" jsonb NOT NULL,
				"headers" jsonb,
				
				"consumer_group" text NOT NULL,
				"service_name" text NOT NULL,
				
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				
				CONSTRAINT "PK_kafka_message_processing" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_kafka_message_processing_topic_partition_offset" UNIQUE ("topic", "partition", "offset")
			)
		`);

		// Create indexes for common query patterns
		// Index on status for filtering by processing status
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_status" 
			ON "core"."kafka_message_processing" ("status")
		`);

		// Index on consumer_group for filtering by consumer group
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_consumer_group" 
			ON "core"."kafka_message_processing" ("consumer_group")
		`);

		// Index on service_name for filtering by service
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_service_name" 
			ON "core"."kafka_message_processing" ("service_name")
		`);

		// Composite index on (status, consumer_group) for common queries
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_status_consumer_group" 
			ON "core"."kafka_message_processing" ("status", "consumer_group")
		`);

		// Index on dead_lettered for dead letter queue queries
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_dead_lettered" 
			ON "core"."kafka_message_processing" ("dead_lettered")
			WHERE "dead_lettered" = true
		`);

		// Index on created_at for time-based queries
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_created_at" 
			ON "core"."kafka_message_processing" ("created_at")
		`);

		// Index on topic for filtering by topic
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_topic" 
			ON "core"."kafka_message_processing" ("topic")
		`);

		// Index on event_id for correlation queries
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_message_processing_event_id" 
			ON "core"."kafka_message_processing" ("event_id")
			WHERE "event_id" IS NOT NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_event_id"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_topic"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_created_at"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_dead_lettered"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_status_consumer_group"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_service_name"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_consumer_group"
		`);
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_message_processing_status"
		`);

		// Drop the table
		await queryRunner.query(`
			DROP TABLE IF EXISTS "core"."kafka_message_processing"
		`);

		// Drop the enum type
		await queryRunner.query(`
			DROP TYPE IF EXISTS core.kafka_message_status
		`);
	}
}

