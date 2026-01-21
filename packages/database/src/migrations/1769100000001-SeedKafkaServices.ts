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

		// Get consumer group ID from environment variable
		// Each environment (dev, staging, prod) should have this set in their secrets
		const consumerGroupId = process.env.KAFKA_CONSUMER_GROUP_ID || 'agent-service-group';

		// Insert Enterprise Agent Updated Consumer
		// Use parameterized query to safely insert the group_id from environment variable
		await queryRunner.query(
			`
			INSERT INTO "core"."kafka_service" ("type", "topic", "group_id", "enabled", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, NOW(), NOW())
			ON CONFLICT ("topic", "group_id") DO NOTHING
		`,
			['consumer', 'Enterprise_AgentUpdated_V2', consumerGroupId],
		);

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
		// Note: This will remove the consumer regardless of group_id value
		// since we can't know which environment's group_id was used
		const consumerGroupId = process.env.KAFKA_CONSUMER_GROUP_ID || 'agent-service-group';
		
		await queryRunner.query(
			`
			DELETE FROM "core"."kafka_service"
			WHERE ("topic" = $1 AND "group_id" = $2)
			OR ("topic" = 'global' AND "group_id" IS NULL)
		`,
			['Enterprise_AgentUpdated_V2', consumerGroupId],
		);
	}
}

