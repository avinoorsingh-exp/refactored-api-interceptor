import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import {
	KafkaMessageProcessingEntity,
	KafkaMessageStatus,
} from '@exprealty/database';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';
import { QueryService } from '../../common/query/query.service.js';
import type { QueryParams } from '@exprealty/shared-domain';
import { KafkaMessageProcessingResponseDto } from './dto/kafka-message-processing-response.dto.js';

/**
 * Data for creating a Kafka message processing record.
 */
export interface CreateKafkaMessageProcessingData {
	topic: string;
	partition: number;
	offset: string;
	messageKey?: string;
	eventId?: string;
	payload: Record<string, unknown>;
	headers?: Record<string, string>;
	consumerGroup: string;
	serviceName: string;
}

/**
 * Data for creating a SENT record from producer.
 */
export interface CreateSentRecordData {
	topic: string;
	partition: number;
	offset: string;
	messageKey?: string;
	eventId?: string;
	payload: Record<string, unknown>;
	headers?: Record<string, string>;
	serviceName: string;
}

/**
 * Service for managing Kafka message processing records.
 * Provides idempotent insert operations that won't block or fail the producer.
 */
@Injectable()
export class KafkaMessageProcessingService {
	private readonly metrics: ReturnType<LoggerService['getMetrics']>;

	constructor(
		@InjectRepository(KafkaMessageProcessingEntity)
		private readonly repository: Repository<KafkaMessageProcessingEntity>,
		private readonly dataSource: DataSource,
		private readonly logger: LoggerService,
		private readonly configService: ConfigService,
		private readonly queryService: QueryService,
	) {
		this.logger.setContext('KafkaMessageProcessingService');
		this.metrics = this.logger.getMetrics();
	}

	/**
	 * Create a SENT record when a message is successfully produced to Kafka.
	 * Uses PostgreSQL's ON CONFLICT to ensure idempotency.
	 * If a record with the same (topic, partition, offset) already exists, it does nothing.
	 * 
	 * On message send:
	 * - Create row with status = SENT
	 * - Set attempt_count = 1
	 * - Set last_attempt_at = now()
	 * 
	 * This operation is atomic and wrapped in a transaction.
	 * The unique constraint on (topic, partition, offset) prevents duplicate rows.
	 * 
	 * This operation will NOT throw errors that would block the producer.
	 * Any errors are logged but not propagated.
	 * 
	 * @param data - Message data from producer
	 * @returns true if operation succeeded, false otherwise
	 */
	async createSentRecord(data: CreateSentRecordData): Promise<boolean> {
		// Use queryRunner for transaction support
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Use raw SQL with ON CONFLICT to insert atomically
			// If record already exists (shouldn't happen for producer), do nothing
			const result = await queryRunner.query(
				`
				INSERT INTO core.kafka_message_processing (
					topic, partition, "offset", message_key, event_id,
					status, attempt_count, last_attempt_at, processed_at,
					error_code, error_message, error_stacktrace, is_retryable, dead_lettered,
					payload, headers, consumer_group, service_name,
					created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NULL, NULL, NULL, NULL, NULL, false, $7, $8, 'producer', $9, NOW(), NOW())
				ON CONFLICT (topic, partition, "offset") 
				DO NOTHING
				RETURNING id, attempt_count, status
				`,
				[
					data.topic,
					data.partition,
					data.offset,
					data.messageKey || null,
					data.eventId || null,
					KafkaMessageStatus.SENT,
					JSON.stringify(data.payload),
					data.headers ? JSON.stringify(data.headers) : null,
					data.serviceName,
				],
			);

			await queryRunner.commitTransaction();

			const record = result?.[0];
			if (record) {
				// Structured log: Record created
				this.logger.info('Kafka message SENT record created', {
					event: 'kafka_message_sent_record_created',
					topic: data.topic,
					partition: data.partition,
					offset: data.offset,
					messageKey: data.messageKey,
					eventId: data.eventId,
					serviceName: data.serviceName,
					attemptCount: 1,
					status: KafkaMessageStatus.SENT,
				});
			}

			return true;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			// Log error but don't throw - this must not block the producer
			this.logger.warn('Failed to create SENT Kafka message processing record (non-blocking)', {
				topic: data.topic,
				partition: data.partition,
				offset: data.offset,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			return false;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Lookup or update a SENT record when message is received by consumer, then increment attempt_count.
	 * Uses PostgreSQL's ON CONFLICT to ensure idempotency.
	 * If a record with the same (topic, partition, offset) already exists, it updates it.
	 * 
	 * On message receive:
	 * - Lookup SENT record using topic, partition, offset
	 * - Increment attempt_count
	 * - Set last_attempt_at = now()
	 * - Status remains SENT (will be updated to PROCESSED/ERROR after processing)
	 * 
	 * This operation is atomic and wrapped in a transaction.
	 * The unique constraint on (topic, partition, offset) prevents duplicate rows.
	 * 
	 * This operation will NOT throw errors that would block the consumer.
	 * Any errors are logged but not propagated.
	 * 
	 * @param data - Message processing data
	 * @returns true if operation succeeded, false otherwise
	 */
	async lookupOrUpdateSentAndIncrementAttempt(data: CreateKafkaMessageProcessingData): Promise<boolean> {
		// Use queryRunner for transaction support
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Check if record exists before insert to determine if it's new or a retry
			const existingRecord = await queryRunner.query(
				`SELECT id, attempt_count, status FROM core.kafka_message_processing WHERE topic = $1 AND partition = $2 AND "offset" = $3`,
				[data.topic, data.partition, data.offset],
			);

			const isNewRecord = !existingRecord || existingRecord.length === 0;
			const previousAttemptCount = existingRecord?.[0]?.attempt_count || 0;
			const previousStatus = existingRecord?.[0]?.status;

			// Use raw SQL with ON CONFLICT to update atomically
			// Record should already exist with SENT status from producer
			// If record exists, increment attempt_count, update last_attempt_at, and update payload with translated version
			// If record doesn't exist (shouldn't happen), create it with SENT status
			const result = await queryRunner.query(
				`
				INSERT INTO core.kafka_message_processing (
					topic, partition, "offset", message_key, event_id,
					status, attempt_count, last_attempt_at, processed_at,
					error_code, error_message, error_stacktrace, is_retryable, dead_lettered,
					payload, headers, consumer_group, service_name,
					created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NULL, NULL, NULL, NULL, NULL, false, $7, $8, $9, $10, NOW(), NOW())
				ON CONFLICT (topic, partition, "offset") 
				DO UPDATE SET
					attempt_count = core.kafka_message_processing.attempt_count + 1,
					last_attempt_at = NOW(),
					updated_at = NOW(),
					payload = EXCLUDED.payload,
					consumer_group = EXCLUDED.consumer_group
				RETURNING id, attempt_count, status
				`,
				[
					data.topic,
					data.partition,
					data.offset,
					data.messageKey || null,
					data.eventId || null,
					KafkaMessageStatus.SENT,
					JSON.stringify(data.payload),
					data.headers ? JSON.stringify(data.headers) : null,
					data.consumerGroup,
					data.serviceName,
				],
			);

			await queryRunner.commitTransaction();

			const record = result?.[0];
			const attemptCount = record?.attempt_count || 1;

			if (isNewRecord) {
				// This shouldn't happen - record should exist from producer
				// But log it if it does
				this.logger.warn('Kafka message processing record created by consumer (should have been created by producer)', {
					event: 'kafka_message_record_created_by_consumer',
					topic: data.topic,
					partition: data.partition,
					offset: data.offset,
					messageKey: data.messageKey,
					eventId: data.eventId,
					consumerGroup: data.consumerGroup,
					serviceName: data.serviceName,
					attemptCount: 1,
					status: KafkaMessageStatus.SENT,
				});
			} else {
				// Structured log: Retry attempt increased
				this.logger.info('Kafka message processing retry attempt increased', {
					event: 'kafka_message_retry_attempt',
					topic: data.topic,
					partition: data.partition,
					offset: data.offset,
					attemptCount,
					previousAttemptCount,
					status: previousStatus,
				});

				// Record retry metric
				this.metrics.recordKafkaMessageRetry({
					topic: data.topic,
					consumerGroup: data.consumerGroup,
					serviceName: data.serviceName,
					attemptNumber: attemptCount,
				});
			}

			return true;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			// Log error but don't throw - this must not block the consumer
			this.logger.warn('Failed to lookup-or-update SENT Kafka message processing record (non-blocking)', {
				topic: data.topic,
				partition: data.partition,
				offset: data.offset,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			return false;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Mark a Kafka message processing record as successfully processed.
	 * Updates status = PROCESSED, processed_at = now(), updated_at = now()
	 * 
	 * Uses primary key (id) for update after finding the record by unique constraint.
	 * This ensures optimal performance and prevents race conditions.
	 * 
	 * This operation is atomic and wrapped in a transaction.
	 * 
	 * @param topic - Kafka topic
	 * @param partition - Kafka partition
	 * @param offset - Kafka offset
	 * @returns true if record was found and updated, false otherwise
	 */
	async markAsProcessed(
		topic: string,
		partition: number,
		offset: string,
	): Promise<boolean> {
		// Use queryRunner for transaction support
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// First, find the record by unique constraint to get the primary key and metadata
			const findResult = await queryRunner.query(
				`
				SELECT id, status, consumer_group, service_name FROM core.kafka_message_processing
				WHERE topic = $1 AND partition = $2 AND "offset" = $3
				FOR UPDATE
				`,
				[topic, partition, offset],
			);

			if (!findResult || findResult.length === 0) {
				await queryRunner.rollbackTransaction();
				this.logger.warn('Kafka message processing record not found for markAsProcessed', {
					topic,
					partition,
					offset,
				});
				return false;
			}

			const record = findResult[0];
			const id = record.id;
			const previousStatus = record.status;
			const consumerGroup = record.consumer_group;
			const serviceName = record.service_name;

			// Update by primary key for optimal performance and to prevent race conditions
			const updateResult = await queryRunner.query(
				`
				UPDATE core.kafka_message_processing
				SET 
					status = $1,
					processed_at = NOW(),
					updated_at = NOW()
				WHERE id = $2
				RETURNING id
				`,
				[KafkaMessageStatus.PROCESSED, id],
			);

			await queryRunner.commitTransaction();

			const wasUpdated = (updateResult?.length ?? 0) > 0;

			if (wasUpdated) {
				// Structured log: Status transition (SENT → PROCESSED)
				this.logger.info('Kafka message processing status transition', {
					event: 'kafka_message_status_transition',
					topic,
					partition,
					offset,
					id,
					previousStatus: previousStatus || KafkaMessageStatus.SENT,
					newStatus: KafkaMessageStatus.PROCESSED,
					transition: `${previousStatus || KafkaMessageStatus.SENT} → ${KafkaMessageStatus.PROCESSED}`,
					consumerGroup,
					serviceName,
				});

				// Record processed metric
				this.metrics.recordKafkaMessageProcessed({
					topic,
					consumerGroup,
					serviceName,
				});
			}

			return wasUpdated;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			// Log error but don't throw - this must not block the producer
			this.logger.warn('Failed to mark Kafka message processing record as processed (non-blocking)', {
				topic,
				partition,
				offset,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			return false;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Mark a Kafka message processing record as failed with error.
	 * Updates status = ERROR and records error information.
	 * 
	 * Uses primary key (id) for update after finding the record by unique constraint.
	 * This ensures optimal performance and prevents race conditions.
	 * 
	 * This operation is atomic and wrapped in a transaction.
	 * 
	 * @param topic - Kafka topic
	 * @param partition - Kafka partition
	 * @param offset - Kafka offset
	 * @param error - Error object or error message
	 * @param retryable - Whether the error is retryable
	 * @returns true if record was found and updated, false otherwise
	 */
	async markAsError(
		topic: string,
		partition: number,
		offset: string,
		error: Error | string,
		retryable: boolean = true,
	): Promise<boolean> {
		// Use queryRunner for transaction support
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// First, find the record by unique constraint to get the primary key and metadata
			const findResult = await queryRunner.query(
				`
				SELECT id, status, consumer_group, service_name FROM core.kafka_message_processing
				WHERE topic = $1 AND partition = $2 AND "offset" = $3
				FOR UPDATE
				`,
				[topic, partition, offset],
			);

			if (!findResult || findResult.length === 0) {
				await queryRunner.rollbackTransaction();
				this.logger.warn('Kafka message processing record not found for markAsError', {
					topic,
					partition,
					offset,
				});
				return false;
			}

			const record = findResult[0];
			const id = record.id;
			const previousStatus = record.status;
			const consumerGroup = record.consumer_group;
			const serviceName = record.service_name;

			const errorMessage = error instanceof Error ? error.message : error;
			const errorStacktrace = error instanceof Error ? error.stack : null;
			const errorCode = error instanceof Error ? error.name : 'Error';

			// Update by primary key for optimal performance and to prevent race conditions
			const updateResult = await queryRunner.query(
				`
				UPDATE core.kafka_message_processing
				SET 
					status = $1,
					error_code = $2,
					error_message = $3,
					error_stacktrace = $4,
					is_retryable = $5,
					updated_at = NOW()
				WHERE id = $6
				RETURNING id
				`,
				[KafkaMessageStatus.ERROR, errorCode, errorMessage, errorStacktrace, retryable, id],
			);

			await queryRunner.commitTransaction();

			const wasUpdated = (updateResult?.length ?? 0) > 0;

			if (wasUpdated) {
				// Structured log: Status transition (SENT → ERROR or PROCESSED → ERROR)
				this.logger.info('Kafka message processing status transition', {
					event: 'kafka_message_status_transition',
					topic,
					partition,
					offset,
					id,
					previousStatus: previousStatus || KafkaMessageStatus.SENT,
					newStatus: KafkaMessageStatus.ERROR,
					transition: `${previousStatus || KafkaMessageStatus.SENT} → ${KafkaMessageStatus.ERROR}`,
					errorCode,
					errorMessage,
					retryable,
					consumerGroup,
					serviceName,
				});

				// Record error metric
				this.metrics.recordKafkaMessageError({
					topic,
					consumerGroup,
					serviceName,
					errorType: errorCode,
				});
			}

			return wasUpdated;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			// Log error but don't throw - this must not block the producer
			this.logger.warn('Failed to mark Kafka message processing record as error (non-blocking)', {
				topic,
				partition,
				offset,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			return false;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Mark a Kafka message processing record as dead lettered.
	 * Updates dead_lettered = true.
	 * 
	 * Uses primary key (id) for update after finding the record by unique constraint.
	 * 
	 * This operation is atomic and wrapped in a transaction.
	 * 
	 * @param topic - Kafka topic
	 * @param partition - Kafka partition
	 * @param offset - Kafka offset
	 * @returns true if record was found and updated, false otherwise
	 */
	async markAsDeadLettered(
		topic: string,
		partition: number,
		offset: string,
	): Promise<boolean> {
		// Use queryRunner for transaction support
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// First, find the record by unique constraint to get the primary key and metadata
			const findResult = await queryRunner.query(
				`
				SELECT id, consumer_group, service_name FROM core.kafka_message_processing
				WHERE topic = $1 AND partition = $2 AND "offset" = $3
				FOR UPDATE
				`,
				[topic, partition, offset],
			);

			if (!findResult || findResult.length === 0) {
				await queryRunner.rollbackTransaction();
				this.logger.warn('Kafka message processing record not found for markAsDeadLettered', {
					topic,
					partition,
					offset,
				});
				return false;
			}

			const record = findResult[0];
			const id = record.id;
			const consumerGroup = record.consumer_group;
			const serviceName = record.service_name;

			// Update by primary key
			const updateResult = await queryRunner.query(
				`
				UPDATE core.kafka_message_processing
				SET 
					dead_lettered = true,
					updated_at = NOW()
				WHERE id = $1
				RETURNING id
				`,
				[id],
			);

			await queryRunner.commitTransaction();

			const wasUpdated = (updateResult?.length ?? 0) > 0;

			if (wasUpdated) {
				// Structured log: Dead lettered
				this.logger.info('Kafka message processing record marked as dead lettered', {
					event: 'kafka_message_dead_lettered',
					topic,
					partition,
					offset,
					id,
					consumerGroup,
					serviceName,
				});

				// Record dead letter metric
				this.metrics.recordKafkaMessageDeadLettered({
					topic,
					consumerGroup,
					serviceName,
				});
			}

			return wasUpdated;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			// Log error but don't throw - this must not block the producer
			this.logger.warn('Failed to mark Kafka message processing record as dead lettered (non-blocking)', {
				topic,
				partition,
				offset,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			return false;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Find a Kafka message processing record by (topic, partition, offset).
	 * 
	 * @param topic - Kafka topic
	 * @param partition - Kafka partition
	 * @param offset - Kafka offset
	 * @returns The record if found, null otherwise
	 */
	async findByMessage(
		topic: string,
		partition: number,
		offset: string,
	): Promise<KafkaMessageProcessingEntity | null> {
		try {
			return await this.repository.findOne({
				where: {
					topic,
					partition,
					offset,
				},
			});
		} catch (error) {
			// Log error but don't throw - this must not block the producer
			this.logger.warn('Failed to find Kafka message processing record (non-blocking)', {
				topic,
				partition,
				offset,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return null;
		}
	}

	/**
	 * Retrieves a paginated list of Kafka message processing records.
	 * Default sort: createdAt DESC (newest first).
	 * 
	 * Supports extensive filtering with all operators (eq, ne, gt, gte, lt, lte, like, ilike, in, nin, between, isNull, isNotNull, etc.)
	 * and logical operators (AND/OR).
	 * 
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @returns Object containing array of records and total count
	 */
	async findPage(query: Partial<QueryParams>): Promise<{ items: KafkaMessageProcessingResponseDto[]; total: number }> {
		const startTime = Date.now();

		try {
			// Normalize query params (handles offset, limit, sort parsing)
			// Note: We don't use entity decorators for validation since KafkaMessageProcessingEntity
			// doesn't have @Searchable/@Filterable/@Sortable decorators
			const normalized = this.queryService.normalize(query);

			// Build query with TypeORM query builder
			const qb = this.repository.createQueryBuilder('kafka_message');

			// Define allowed filterable fields (camelCase field names as used in API)
			const allowedFilterFields = new Set([
				'topic',
				'status',
				'consumerGroup',
				'serviceName',
				'deadLettered',
				'eventId',
				'createdAt',
				'updatedAt',
				'lastAttemptAt',
				'processedAt',
				'attemptCount',
				'errorCode',
				'errorMessage',
				'isRetryable',
			]);

			// Define allowed sortable fields
			// Note: Fields starting with "payload." will be treated as JSONB path sorting
			// "payload" itself will sort by the entire JSONB value
			const allowedSortFields = new Set([
				'createdAt',
				'updatedAt',
				'topic',
				'status',
				'messageKey',
				'attemptCount',
				'lastAttemptAt',
				'processedAt',
				'payload', // Allow sorting by entire JSONB payload
			]);

			// Map camelCase field names to database column names
			const fieldMap: Record<string, string> = {
				topic: 'topic',
				status: 'status',
				messageKey: 'message_key',
				consumerGroup: 'consumer_group',
				serviceName: 'service_name',
				deadLettered: 'dead_lettered',
				eventId: 'event_id',
				createdAt: 'created_at',
				updatedAt: 'updated_at',
				lastAttemptAt: 'last_attempt_at',
				processedAt: 'processed_at',
				attemptCount: 'attempt_count',
				errorCode: 'error_code',
				errorMessage: 'error_message',
				isRetryable: 'is_retryable',
			};

			// Apply filters using QueryService (supports all operators and logical operators)
			if (normalized.filter && normalized.filter.conditions.length > 0) {
				// Keep camelCase field names for validation, but map to DB column names in SQL
				// We'll apply filters manually to handle the field mapping
				const { conditions, logicalOperator } = normalized.filter;
				
				qb.andWhere(
					new Brackets((subQb) => {
						conditions.forEach((condition, index) => {
							// Validate field is allowed (using camelCase)
							if (!allowedFilterFields.has(condition.field)) {
								throw new Error(`Field '${condition.field}' is not allowed for filtering`);
							}

							// Get database column name
							const dbFieldName = fieldMap[condition.field] || condition.field;
							const paramName = `filter_${condition.field}_${index}`;
							const fieldPath = `kafka_message.${dbFieldName}`;
							const whereMethod = logicalOperator === 'OR' ? 'orWhere' : 'andWhere';

							// Apply filter condition based on operator
							switch (condition.operator) {
								case 'eq':
									subQb[whereMethod](`${fieldPath} = :${paramName}`, { [paramName]: condition.value });
									break;
								case 'ne':
									subQb[whereMethod](`${fieldPath} != :${paramName}`, { [paramName]: condition.value });
									break;
								case 'gt':
									subQb[whereMethod](`${fieldPath} > :${paramName}`, { [paramName]: condition.value });
									break;
								case 'gte':
									subQb[whereMethod](`${fieldPath} >= :${paramName}`, { [paramName]: condition.value });
									break;
								case 'lt':
									subQb[whereMethod](`${fieldPath} < :${paramName}`, { [paramName]: condition.value });
									break;
								case 'lte':
									subQb[whereMethod](`${fieldPath} <= :${paramName}`, { [paramName]: condition.value });
									break;
								case 'like':
									subQb[whereMethod](`${fieldPath} LIKE :${paramName}`, { [paramName]: `%${condition.value}%` });
									break;
								case 'ilike':
									subQb[whereMethod](`${fieldPath} ILIKE :${paramName}`, { [paramName]: `%${condition.value}%` });
									break;
								case 'in':
									subQb[whereMethod](`${fieldPath} IN (:...${paramName})`, { [paramName]: condition.value });
									break;
								case 'nin':
									subQb[whereMethod](`${fieldPath} NOT IN (:...${paramName})`, { [paramName]: condition.value });
									break;
								case 'between':
									subQb[whereMethod](`${fieldPath} BETWEEN :${paramName}_start AND :${paramName}_end`, {
										[`${paramName}_start`]: condition.value[0],
										[`${paramName}_end`]: condition.value[1],
									});
									break;
								case 'isNull':
									subQb[whereMethod](`${fieldPath} IS NULL`);
									break;
								case 'isNotNull':
									subQb[whereMethod](`${fieldPath} IS NOT NULL`);
									break;
								default:
									throw new Error(`Unsupported filter operator: ${condition.operator}`);
							}
						});
					}),
				);
			}

			// Apply sorting using QueryService (supports multiple sort conditions)
			if (normalized.sort && normalized.sort.conditions.length > 0) {
				// Keep camelCase field names for validation, but map to DB column names in SQL
				normalized.sort.conditions.forEach((condition, index) => {
					// Check if this is sorting by the entire payload JSONB value
					if (condition.field === 'payload') {
						// Sort by the entire JSONB payload value
						// PostgreSQL JSONB comparison sorts by the JSONB representation
						const sortExpression = 'kafka_message.payload';
						
						// Apply sorting on entire JSONB payload
						if (index === 0) {
							qb.orderBy(sortExpression, condition.direction);
						} else {
							qb.addOrderBy(sortExpression, condition.direction);
						}
					} else if (condition.field.startsWith('payload.')) {
						// Extract the JSONB path (e.g., "payload.eventId" -> "eventId")
						const jsonbPath = condition.field.replace(/^payload\./, '');
						
						// Use PostgreSQL JSONB operator to extract and sort by the field
						// payload->>'fieldName' extracts as text, which works for most sorting needs
						// For numeric sorting, we could use payload->'fieldName' and cast, but text works for most cases
						const sortExpression = `kafka_message.payload->>'${jsonbPath}'`;
						
						// Apply sorting on JSONB field
						if (index === 0) {
							qb.orderBy(sortExpression, condition.direction);
						} else {
							qb.addOrderBy(sortExpression, condition.direction);
						}
					} else {
						// Validate field is allowed (using camelCase)
						if (!allowedSortFields.has(condition.field)) {
							throw new Error(`Field '${condition.field}' is not allowed for sorting`);
						}

						// Get database column name
						const dbFieldName = fieldMap[condition.field] || condition.field;
						
						// Apply sorting
						if (index === 0) {
							qb.orderBy(`kafka_message.${dbFieldName}`, condition.direction);
						} else {
							qb.addOrderBy(`kafka_message.${dbFieldName}`, condition.direction);
						}
					}
				});
			} else {
				// Default sort: createdAt DESC (newest first)
				qb.orderBy('kafka_message.created_at', 'DESC');
			}

			// Apply pagination
			qb.skip(normalized.offset).take(normalized.limit);

			// Execute query
			const [entities, total] = await qb.getManyAndCount();

			const duration = Date.now() - startTime;
			this.logger.info(
				`Retrieved ${entities.length} Kafka message processing records (offset: ${normalized.offset}, limit: ${normalized.limit}, total: ${total}) in ${duration}ms`,
			);

			// Map entities to DTOs
			const items: KafkaMessageProcessingResponseDto[] = entities.map((entity) => ({
				id: entity.id,
				topic: entity.topic,
				partition: entity.partition,
				offset: entity.offset,
				messageKey: entity.messageKey,
				eventId: entity.eventId,
				status: entity.status,
				attemptCount: entity.attemptCount,
				lastAttemptAt: entity.lastAttemptAt,
				processedAt: entity.processedAt,
				errorCode: entity.errorCode,
				errorMessage: entity.errorMessage,
				errorStacktrace: entity.errorStacktrace,
				isRetryable: entity.isRetryable,
				deadLettered: entity.deadLettered,
				payload: entity.payload,
				headers: entity.headers,
				consumerGroup: entity.consumerGroup,
				serviceName: entity.serviceName,
				createdAt: entity.createdAt,
				updatedAt: entity.updatedAt,
			}));

			return {
				items,
				total,
			};
		} catch (error) {
			const duration = Date.now() - startTime;
			this.logger.error(
				`Failed to retrieve Kafka message processing records page: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);
			throw error;
		}
	}
}

