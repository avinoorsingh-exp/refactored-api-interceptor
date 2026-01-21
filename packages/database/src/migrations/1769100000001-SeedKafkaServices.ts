import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed initial Kafka service definitions.
 *
 * Purpose:
 * - Insert initial Kafka service definitions for existing consumers and producers
 * - These services will be automatically started by KafkaBootstrapService on application bootstrap
 * - Services can be enabled/disabled via the database without code changes
 *
 * Note: This migration is idempotent - it checks if records exist before inserting.
 */
export class SeedKafkaServices1769100000001 implements MigrationInterface {
	name = 'SeedKafkaServices1769100000001';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if records already exist (migration should be idempotent)
		const existingRecords = await queryRunner.query(`
			SELECT COUNT(*) as count FROM "core"."kafka_service"
		`);

		if (parseInt(existingRecords[0].count, 10) > 0) {
			// Records already exist - skip migration
			return;
		}

		// Insert Enterprise Agent Updated Consumer
		await queryRunner.query(`
			INSERT INTO "core"."kafka_service" ("type", "topic", "group_id", "enabled", "created_at", "updated_at")
			VALUES ('consumer', 'Enterprise_AgentUpdated_V2', 'agent-service-group', true, NOW(), NOW())
			ON CONFLICT ("topic", "group_id") DO NOTHING
		`);

		// Insert Kafka Producer Service
		// Note: Producer uses 'global' as topic (not topic-specific) and has no group_id
		await queryRunner.query(`
			INSERT INTO "core"."kafka_service" ("type", "topic", "group_id", "enabled", "created_at", "updated_at")
			VALUES ('producer', 'global', NULL, true, NOW(), NOW())
			ON CONFLICT ("topic", "group_id") DO NOTHING
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove the seeded Kafka service definitions
		await queryRunner.query(`
			DELETE FROM "core"."kafka_service"
			WHERE ("topic" = 'Enterprise_AgentUpdated_V2' AND "group_id" = 'agent-service-group')
			OR ("topic" = 'global' AND "group_id" IS NULL)
		`);
	}
}

