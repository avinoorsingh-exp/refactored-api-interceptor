import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

/**
 * Migration: Create API monitoring tables.
 *
 * Purpose:
 * - Create api_actor table for tracking external actors (users, API keys, service accounts)
 * - Create api_request_log table for high-volume request logging
 * - Create api_route_stats table for pre-aggregated route statistics
 * - Add indexes optimized for time-range queries and aggregations
 *
 * Performance considerations:
 * - api_request_log is append-only and high-volume - indexes are critical
 * - api_route_stats uses unique constraint to prevent duplicate aggregations
 * - All timestamp columns are indexed for time-range queries
 */
export class CreateApiMonitoringTables1769500000000 implements MigrationInterface {
	name = 'CreateApiMonitoringTables1769500000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create api_actor table
		await queryRunner.createTable(
			new Table({
				name: 'api_actor',
				schema: 'core',
				columns: [
					{
						name: 'id',
						type: 'uuid',
						isPrimary: true,
						generationStrategy: 'uuid',
						default: 'gen_random_uuid()',
					},
					{
						name: 'type',
						type: 'text',
						isNullable: false,
					},
					{
						name: 'identifier',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'metadata',
						type: 'jsonb',
						isNullable: true,
					},
					{
						name: 'active',
						type: 'boolean',
						default: true,
					},
					{
						name: 'created_at',
						type: 'timestamp with time zone',
						default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'updated_at',
						type: 'timestamp with time zone',
						default: 'CURRENT_TIMESTAMP',
					},
				],
			}),
			true,
		);

		// Create unique index on api_actor (type, identifier)
		await queryRunner.createIndex(
			'core.api_actor',
			new TableIndex({
				name: 'idx_api_actor_type_identifier',
				columnNames: ['type', 'identifier'],
				isUnique: true,
			}),
		);

		// Create index on api_actor created_at for queries
		await queryRunner.createIndex(
			'core.api_actor',
			new TableIndex({
				name: 'idx_api_actor_created_at',
				columnNames: ['created_at'],
			}),
		);

		// Create api_request_log table
		await queryRunner.createTable(
			new Table({
				name: 'api_request_log',
				schema: 'core',
				columns: [
					{
						name: 'id',
						type: 'uuid',
						isPrimary: true,
						generationStrategy: 'uuid',
						default: 'gen_random_uuid()',
					},
					{
						name: 'route',
						type: 'text',
						isNullable: false,
					},
					{
						name: 'method',
						type: 'text',
						isNullable: false,
					},
					{
						name: 'status_code',
						type: 'integer',
						isNullable: false,
					},
					{
						name: 'latency_ms',
						type: 'integer',
						isNullable: false,
					},
					{
						name: 'request_size_bytes',
						type: 'integer',
						isNullable: true,
					},
					{
						name: 'response_size_bytes',
						type: 'integer',
						isNullable: true,
					},
					{
						name: 'ip_address',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'user_agent',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'correlation_id',
						type: 'uuid',
						isNullable: false,
					},
					{
						name: 'timestamp',
						type: 'timestamp with time zone',
						isNullable: false,
					},
					{
						name: 'actor_id',
						type: 'uuid',
						isNullable: true,
					},
					{
						name: 'actor_type',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'has_error',
						type: 'boolean',
						default: false,
					},
					{
						name: 'error_classification',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'error_message',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'stack_trace',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'created_at',
						type: 'timestamp with time zone',
						default: 'CURRENT_TIMESTAMP',
					},
				],
			}),
			true,
		);

		// Create indexes on api_request_log for efficient queries
		await queryRunner.createIndex(
			'core.api_request_log',
			new TableIndex({
				name: 'idx_api_request_log_timestamp',
				columnNames: ['timestamp'],
			}),
		);

		await queryRunner.createIndex(
			'core.api_request_log',
			new TableIndex({
				name: 'idx_api_request_log_route_method',
				columnNames: ['route', 'method'],
			}),
		);

		await queryRunner.createIndex(
			'core.api_request_log',
			new TableIndex({
				name: 'idx_api_request_log_actor',
				columnNames: ['actor_id', 'timestamp'],
			}),
		);

		await queryRunner.createIndex(
			'core.api_request_log',
			new TableIndex({
				name: 'idx_api_request_log_correlation',
				columnNames: ['correlation_id'],
			}),
		);

		await queryRunner.createIndex(
			'core.api_request_log',
			new TableIndex({
				name: 'idx_api_request_log_status',
				columnNames: ['status_code', 'timestamp'],
			}),
		);

		await queryRunner.createIndex(
			'core.api_request_log',
			new TableIndex({
				name: 'idx_api_request_log_error',
				columnNames: ['has_error', 'timestamp'],
			}),
		);

		// Create api_route_stats table
		await queryRunner.createTable(
			new Table({
				name: 'api_route_stats',
				schema: 'core',
				columns: [
					{
						name: 'id',
						type: 'uuid',
						isPrimary: true,
						generationStrategy: 'uuid',
						default: 'gen_random_uuid()',
					},
					{
						name: 'route',
						type: 'text',
						isNullable: false,
					},
					{
						name: 'method',
						type: 'text',
						isNullable: false,
					},
					{
						name: 'time_bucket',
						type: 'text',
						isNullable: false,
					},
					{
						name: 'bucket_start',
						type: 'timestamp with time zone',
						isNullable: false,
					},
					{
						name: 'request_count',
						type: 'integer',
						default: 0,
					},
					{
						name: 'error_count',
						type: 'integer',
						default: 0,
					},
					{
						name: 'latency_p50',
						type: 'integer',
						isNullable: true,
					},
					{
						name: 'latency_p95',
						type: 'integer',
						isNullable: true,
					},
					{
						name: 'latency_p99',
						type: 'integer',
						isNullable: true,
					},
					{
						name: 'latency_min',
						type: 'integer',
						isNullable: true,
					},
					{
						name: 'latency_max',
						type: 'integer',
						isNullable: true,
					},
					{
						name: 'status_code_counts',
						type: 'jsonb',
						isNullable: true,
					},
					{
						name: 'created_at',
						type: 'timestamp with time zone',
						default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'updated_at',
						type: 'timestamp with time zone',
						default: 'CURRENT_TIMESTAMP',
					},
				],
			}),
			true,
		);

		// Create unique constraint on api_route_stats
		await queryRunner.createUniqueConstraint(
			'core.api_route_stats',
			new TableUnique({
				name: 'uq_api_route_stats_route_method_bucket',
				columnNames: ['route', 'method', 'time_bucket', 'bucket_start'],
			}),
		);

		// Create indexes on api_route_stats
		await queryRunner.createIndex(
			'core.api_route_stats',
			new TableIndex({
				name: 'idx_api_route_stats_bucket_start',
				columnNames: ['bucket_start'],
			}),
		);

		await queryRunner.createIndex(
			'core.api_route_stats',
			new TableIndex({
				name: 'idx_api_route_stats_route_method',
				columnNames: ['route', 'method'],
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes first
		await queryRunner.dropIndex('core.api_route_stats', 'idx_api_route_stats_route_method');
		await queryRunner.dropIndex('core.api_route_stats', 'idx_api_route_stats_bucket_start');
		await queryRunner.dropIndex('core.api_request_log', 'idx_api_request_log_error');
		await queryRunner.dropIndex('core.api_request_log', 'idx_api_request_log_status');
		await queryRunner.dropIndex('core.api_request_log', 'idx_api_request_log_correlation');
		await queryRunner.dropIndex('core.api_request_log', 'idx_api_request_log_actor');
		await queryRunner.dropIndex('core.api_request_log', 'idx_api_request_log_route_method');
		await queryRunner.dropIndex('core.api_request_log', 'idx_api_request_log_timestamp');
		await queryRunner.dropIndex('core.api_actor', 'idx_api_actor_created_at');
		await queryRunner.dropIndex('core.api_actor', 'idx_api_actor_type_identifier');

		// Drop tables
		await queryRunner.dropTable('core.api_route_stats', true);
		await queryRunner.dropTable('core.api_request_log', true);
		await queryRunner.dropTable('core.api_actor', true);
	}
}


