import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create kafka_service table.
 *
 * Purpose:
 * - Store Kafka service definitions (consumers and producers)
 * - Enable runtime control plane for Kafka services
 * - Decouple service configuration from runtime state
 *
 * Note: Runtime state (running/stopped/error) is NOT stored in the database.
 * It is managed in-memory by KafkaRuntimeManager.
 */
export class CreateKafkaServiceTable1769100000000 implements MigrationInterface {
	name = 'CreateKafkaServiceTable1769100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if table already exists (migration should be idempotent)
		const tableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_service'
		`);

		if (tableExists.length > 0) {
			// Table already exists - skip migration
			return;
		}

		// Create kafka_service table
		await queryRunner.query(`
			CREATE TABLE "core"."kafka_service" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"type" text NOT NULL CHECK ("type" IN ('consumer', 'producer')),
				"topic" text NOT NULL,
				"group_id" text,
				"enabled" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_kafka_service" PRIMARY KEY ("id")
			)
		`);

		// Create unique index on (topic, group_id) to prevent duplicate service definitions
		// Note: group_id can be NULL for producers, but the unique constraint handles this correctly
		await queryRunner.query(`
			CREATE UNIQUE INDEX "idx_kafka_service_topic_group" 
			ON "core"."kafka_service" ("topic", "group_id")
		`);

		// Create index on enabled for efficient filtering
		await queryRunner.query(`
			CREATE INDEX "idx_kafka_service_enabled" 
			ON "core"."kafka_service" ("enabled")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Check if table exists before dropping
		const tableExists = await queryRunner.query(`
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'core' 
			AND table_name = 'kafka_service'
		`);

		if (tableExists.length === 0) {
			// Table doesn't exist - nothing to drop
			return;
		}

		// Drop indexes first
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_service_enabled"
		`);

		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_kafka_service_topic_group"
		`);

		// Drop table
		await queryRunner.query(`
			DROP TABLE IF EXISTS "core"."kafka_service"
		`);
	}
}


