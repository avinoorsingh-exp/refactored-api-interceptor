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
		// Each environment (dev, test, qa, prod) should have this set in AWS Secrets Manager
		// Falls back to default if not set (Jenkinsfile ensures it's set, but this prevents migration failures)
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

		// Insert AU Agent Details Agent Updated Consumer
		await queryRunner.query(
			`
			INSERT INTO "core"."kafka_service" ("type", "topic", "group_id", "enabled", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, NOW(), NOW())
			ON CONFLICT ("topic", "group_id") DO NOTHING
		`,
			['consumer', 'AU_AgentDetails_AgentUpdated_V2', consumerGroupId],
		);

		// Insert UK Agent Details Agent Updated Consumer
		await queryRunner.query(
			`
			INSERT INTO "core"."kafka_service" ("type", "topic", "group_id", "enabled", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, NOW(), NOW())
			ON CONFLICT ("topic", "group_id") DO NOTHING
		`,
			['consumer', 'UK_AgentDetails_AgentUpdated_V2', consumerGroupId],
		);

		// Insert Global ADS Agent Created Consumer
		await queryRunner.query(
			`
			INSERT INTO "core"."kafka_service" ("type", "topic", "group_id", "enabled", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, NOW(), NOW())
			ON CONFLICT ("topic", "group_id") DO NOTHING
		`,
			['consumer', 'Global_ADS_AgentCreated_V2', consumerGroupId],
		);

		// Insert Global ADS Agent Updated Consumer
		await queryRunner.query(
			`
			INSERT INTO "core"."kafka_service" ("type", "topic", "group_id", "enabled", "created_at", "updated_at")
			VALUES ($1, $2, $3, true, NOW(), NOW())
			ON CONFLICT ("topic", "group_id") DO NOTHING
		`,
			['consumer', 'Global_ADS_AgentUpdated_V2', consumerGroupId],
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
		// Note: This will remove the consumers for the current environment's group_id
		// Falls back to default if not set (Jenkinsfile ensures it's set, but this prevents migration failures)
		const consumerGroupId = process.env.KAFKA_CONSUMER_GROUP_ID || 'agent-service-group';
		
		await queryRunner.query(
			`
			DELETE FROM "core"."kafka_service"
			WHERE ("topic" = $1 AND "group_id" = $2)
			OR ("topic" = $3 AND "group_id" = $2)
			OR ("topic" = $4 AND "group_id" = $2)
			OR ("topic" = $5 AND "group_id" = $2)
			OR ("topic" = $6 AND "group_id" = $2)
			OR ("topic" = 'global' AND "group_id" IS NULL)
		`,
			[
				'Enterprise_AgentUpdated_V2',
				consumerGroupId,
				'AU_AgentDetails_AgentUpdated_V2',
				'UK_AgentDetails_AgentUpdated_V2',
				'Global_ADS_AgentCreated_V2',
				'Global_ADS_AgentUpdated_V2',
			],
		);
	}
}

