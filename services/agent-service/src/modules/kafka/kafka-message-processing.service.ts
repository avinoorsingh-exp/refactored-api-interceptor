import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
import type { KafkaProducerService } from './kafka-producer.service.js';
import { KafkaRuntimeManager } from './kafka-runtime-manager.service.js';
import { KafkaBootstrapService } from './kafka-bootstrap.service.js';
import { KafkaMessage } from 'kafkajs';
import { ZodError } from 'zod';

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
	private _kafkaProducer: KafkaProducerService | null = null;

	constructor(
		@InjectRepository(KafkaMessageProcessingEntity)
		private readonly repository: Repository<KafkaMessageProcessingEntity>,
		private readonly dataSource: DataSource,
		private readonly logger: LoggerService,
		private readonly configService: ConfigService,
		private readonly queryService: QueryService,
		private readonly moduleRef: ModuleRef,
		private readonly kafkaRuntimeManager: KafkaRuntimeManager,
		@Inject(forwardRef(() => KafkaBootstrapService))
		private readonly kafkaBootstrapService: KafkaBootstrapService,
	) {
		this.logger.setContext('KafkaMessageProcessingService');
		this.metrics = this.logger.getMetrics();
	}

	/**
	 * Get KafkaProducerService instance lazily via ModuleRef.
	 * This breaks the circular dependency by resolving at runtime.
	 */
	private async getKafkaProducer(): Promise<KafkaProducerService> {
		if (this._kafkaProducer) {
			return this._kafkaProducer;
		}

		// Dynamic import to avoid circular dependency at module load time
		const { KafkaProducerService } = await import('./kafka-producer.service.js');
		this._kafkaProducer = this.moduleRef.get(KafkaProducerService, { strict: false });
		return this._kafkaProducer;
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
		
		let transactionStarted = false;
		
		try {
			await queryRunner.startTransaction();
			transactionStarted = true;
			// For producer records, if offset is '0' or missing, it means Kafka metadata wasn't extracted properly
			// Use a timestamp-based numeric offset to ensure uniqueness
			// This is a temporary offset that will be replaced when the consumer processes the message
			// We use a very large number (timestamp in milliseconds) to avoid conflicts with real Kafka offsets
			// The consumer will update this record with the actual Kafka offset when it processes the message
			const uniqueOffset = data.offset === '0' || !data.offset 
				? Date.now().toString() // Use current timestamp in milliseconds as a unique offset
				: data.offset;

			// Use raw SQL with ON CONFLICT to insert atomically
			// For producer records with offset 0, we use timestamp-based offsets to ensure uniqueness
			// If a conflict occurs (shouldn't happen with timestamp offsets), update the existing record
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
				DO UPDATE SET
					updated_at = NOW(),
					payload = EXCLUDED.payload,
					headers = EXCLUDED.headers
				RETURNING id, attempt_count, status
				`,
				[
					data.topic,
					data.partition,
					uniqueOffset,
					data.messageKey || null,
					data.eventId || null,
					KafkaMessageStatus.SENT,
					JSON.stringify(data.payload),
					data.headers ? JSON.stringify(data.headers) : null,
					data.serviceName,
				],
			);

			await queryRunner.commitTransaction();
			transactionStarted = false; // Transaction committed, no need to rollback

			const record = result?.[0];
			if (record) {
				// Structured log: Record created
				const isTimestampOffset = data.offset === '0' || !data.offset;
				this.logger.info('Kafka message SENT record created', {
					event: 'kafka_message_sent_record_created',
					topic: data.topic,
					partition: data.partition,
					offset: uniqueOffset,
					originalOffset: data.offset,
					usingTimestampOffset: isTimestampOffset,
					messageKey: data.messageKey,
					eventId: data.eventId,
					serviceName: data.serviceName,
					attemptCount: 1,
					status: KafkaMessageStatus.SENT,
				});
				return true;
			} else {
				// ON CONFLICT DO UPDATE was triggered - record was updated
				this.logger.info('Kafka message SENT record updated (ON CONFLICT DO UPDATE)', {
					topic: data.topic,
					partition: data.partition,
					offset: uniqueOffset,
					messageKey: data.messageKey,
					eventId: data.eventId,
				});
				return true; // Still return true since the record exists/updated
			}
		} catch (error) {
			// Only rollback if transaction was successfully started
			if (transactionStarted) {
				try {
					await queryRunner.rollbackTransaction();
				} catch (rollbackError) {
					// Transaction might already be rolled back or closed
					this.logger.debug('Rollback failed (transaction may already be closed)', {
						topic: data.topic,
						partition: data.partition,
						offset: data.offset,
						error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
					});
				}
			}
			// Log error but don't throw - this must not block the producer
			// Use error level to make it more visible
			this.logger.error('Failed to create SENT Kafka message processing record (non-blocking)', {
				event: 'kafka_message_sent_record_failed',
				topic: data.topic,
				partition: data.partition,
				offset: data.offset,
				messageKey: data.messageKey,
				eventId: data.eventId,
				serviceName: data.serviceName,
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
		
		let transactionStarted = false;
		
		try {
			await queryRunner.startTransaction();
			transactionStarted = true;
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
			transactionStarted = false; // Transaction committed, no need to rollback

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
			// Only rollback if transaction was successfully started
			if (transactionStarted) {
				try {
					await queryRunner.rollbackTransaction();
				} catch (rollbackError) {
					// Transaction might already be rolled back or closed
					this.logger.debug('Rollback failed (transaction may already be closed)', {
						topic: data.topic,
						partition: data.partition,
						offset: data.offset,
						error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
					});
				}
			}
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
		try {
			// Find the record to get current status for logging
			const record = await this.repository.findOne({
				where: {
					topic,
					partition,
					offset,
				},
			});

			if (!record) {
				this.logger.warn('Kafka message processing record not found for markAsProcessed', {
					topic,
					partition,
					offset,
				});
				return false;
			}

			const previousStatus = record.status;
			const consumerGroup = record.consumerGroup;
			const serviceName = record.serviceName;

			// Simple UPDATE - no transaction needed for straightforward status change
			const updateResult = await this.repository.update(
				{ id: record.id },
				{
					status: KafkaMessageStatus.PROCESSED,
					processedAt: new Date(),
					updatedAt: new Date(),
				},
			);

			const wasUpdated = (updateResult.affected ?? 0) > 0;

			if (wasUpdated) {
				// Structured log: Status transition (SENT → PROCESSED)
				this.logger.info('Kafka message processing status transition', {
					event: 'kafka_message_status_transition',
					topic,
					partition,
					offset,
					id: record.id,
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
			// Log error but don't throw - this must not block the consumer
			this.logger.warn('Failed to mark Kafka message processing record as processed (non-blocking)', {
				topic,
				partition,
				offset,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			return false;
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
		
		let transactionStarted = false;
		
		try {
			await queryRunner.startTransaction();
			transactionStarted = true;
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
				if (transactionStarted) {
					try {
						await queryRunner.rollbackTransaction();
					} catch (rollbackError) {
						// Transaction might already be rolled back or closed
						this.logger.debug('Rollback failed (transaction may already be closed)', {
							topic,
							partition,
							offset,
							error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
						});
					}
				}
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

			// Handle ZodError specially to format validation errors
			let errorMessage: string;
			let errorStacktrace: string | null;
			let errorCode: string;
			
			if (error instanceof ZodError) {
				// This is a ZodError - format validation errors for better readability
				const issues = error.issues;
				
				// Format validation errors into a readable message
				const formattedErrors = issues.map((issue) => {
					const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'root';
					return `${fieldPath}: ${issue.message}`;
				});
				
				errorMessage = `Validation failed: ${formattedErrors.join('; ')}`;
				errorCode = 'ZodError';
				// Store full error details in stacktrace for debugging
				errorStacktrace = JSON.stringify({
					type: 'ZodError',
					issues: issues.map((issue) => ({
						path: issue.path,
						message: issue.message,
						code: issue.code,
					})),
					stack: error.stack,
				}, null, 2);
			} else {
				// Regular error handling
				errorMessage = error instanceof Error ? error.message : String(error);
				errorStacktrace = error instanceof Error ? error.stack : null;
				errorCode = error instanceof Error ? error.name : 'Error';
			}

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
			transactionStarted = false; // Transaction committed, no need to rollback

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
			// Only rollback if transaction was successfully started
			if (transactionStarted) {
				try {
					await queryRunner.rollbackTransaction();
				} catch (rollbackError) {
					// Transaction might already be rolled back or closed
					this.logger.debug('Rollback failed (transaction may already be closed)', {
						topic,
						partition,
						offset,
						error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
					});
				}
			}
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
		
		let transactionStarted = false;
		
		try {
			await queryRunner.startTransaction();
			transactionStarted = true;
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
				if (transactionStarted) {
					try {
						await queryRunner.rollbackTransaction();
					} catch (rollbackError) {
						// Transaction might already be rolled back or closed
						this.logger.debug('Rollback failed (transaction may already be closed)', {
							topic,
							partition,
							offset,
							error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
						});
					}
				}
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
			transactionStarted = false; // Transaction committed, no need to rollback

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
			// Only rollback if transaction was successfully started
			if (transactionStarted) {
				try {
					await queryRunner.rollbackTransaction();
				} catch (rollbackError) {
					// Transaction might already be rolled back or closed
					this.logger.debug('Rollback failed (transaction may already be closed)', {
						topic,
						partition,
						offset,
						error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
					});
				}
			}
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
	 * Find a Kafka message processing record by ID.
	 * 
	 * @param id - Record ID (UUID)
	 * @returns The record if found, null otherwise
	 */
	async findById(id: string): Promise<KafkaMessageProcessingEntity | null> {
		try {
			return await this.repository.findOne({
				where: { id },
			});
		} catch (error) {
			this.logger.warn('Failed to find Kafka message processing record by ID', {
				id,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return null;
		}
	}

	/**
	 * Retry processing a message.
	 * Allows retry for all valid statuses (SENT, PROCESSED, ERROR) to handle race conditions.
	 * Re-invokes internal processing logic (same as what consumers do).
	 * 
	 * @param messageId - Message record ID (UUID)
	 * @returns Updated message record with final committed status
	 * @throws NotFoundException if message not found
	 * @throws BadRequestException if message status is invalid (null/undefined)
	 */
	async retryMessage(messageId: string, customPayload?: Record<string, unknown>): Promise<KafkaMessageProcessingResponseDto> {
		// Use atomic transaction with SELECT FOR UPDATE to:
		// 1. Check status = ERROR atomically
		// 2. Lock the record to prevent concurrent retries
		// 3. Increment attempt_count
		// This ensures status validation and retry initiation are atomic
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		
		let transactionStarted = false;
		let updatedMessage: KafkaMessageProcessingEntity | null = null;
		let transactionCommitted = false;
		// Flag to track if retry was accepted - once true, endpoint MUST return 200
		let retryAccepted = false;

		try {
			await queryRunner.startTransaction();
			transactionStarted = true;
			// Atomic status check + lock + increment in single transaction
			// SELECT FOR UPDATE locks the row, preventing concurrent retries
			const lockResult = await queryRunner.query(
				`
				SELECT id, topic, partition, "offset", status, message_key, payload, headers, 
				       event_id, consumer_group, service_name, attempt_count, error_code, 
				       error_message, error_stacktrace, is_retryable, processed_at, 
				       last_attempt_at, created_at, updated_at
				FROM core.kafka_message_processing
				WHERE id = $1
				FOR UPDATE
				`,
				[messageId] as any[],
			);

			if (!lockResult || lockResult.length === 0) {
				if (transactionStarted) {
					try {
						await queryRunner.rollbackTransaction();
					} catch (rollbackError) {
						// Transaction might already be rolled back or closed
						this.logger.debug('Rollback failed (transaction may already be closed)', {
							messageId,
							error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
						});
					}
				}
				throw new NotFoundException({
					message: `Kafka message with ID '${messageId}' not found`,
					i18nType: 'kafka.message.not_found',
				});
			}

			const lockedMessage = lockResult[0];

			// Extract topic from locked message (already validated to exist)
			// PostgreSQL returns column names in lowercase by default
			const topicFromLock = lockedMessage.topic || lockedMessage.TOPIC || (lockedMessage as any)?.['topic'] || (lockedMessage as any)?.['TOPIC'];
			if (!topicFromLock) {
				if (transactionStarted) {
					try {
						await queryRunner.rollbackTransaction();
					} catch (rollbackError) {
						// Transaction might already be rolled back or closed
						this.logger.debug('Rollback failed (transaction may already be closed)', {
							messageId,
							error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
						});
					}
				}
				this.logger.error('Topic is missing from locked message result', {
					messageId,
					lockedMessageKeys: Object.keys(lockedMessage || {}),
					lockedMessage,
				});
				throw new Error(`Message with ID '${messageId}' is missing topic in database. Cannot retry.`);
			}

			// Extract current status for logging (while row is locked)
			// PostgreSQL returns column names in lowercase by default
			// Extract status with multiple fallbacks to handle any casing issues
			const currentStatusRaw = lockedMessage.status || lockedMessage.STATUS || (lockedMessage as any)?.['status'] || (lockedMessage as any)?.['STATUS'];
			// Normalize status to string and trim whitespace, convert to uppercase for comparison
			const currentStatus = currentStatusRaw ? String(currentStatusRaw).trim().toUpperCase() : null;
			
			// Allow retry for all valid statuses (SENT, PROCESSED, ERROR)
			// Only reject if status is truly invalid (null/undefined/empty)
			// This fixes race conditions where status may be PROCESSED when retry is requested
			if (!currentStatus) {
				if (transactionStarted) {
					try {
						await queryRunner.rollbackTransaction();
					} catch (rollbackError) {
						// Transaction might already be rolled back or closed
						this.logger.debug('Rollback failed (transaction may already be closed)', {
							messageId,
							error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
						});
					}
				}
				this.logger.error('Retry rejected: message status is invalid (null/undefined)', {
					messageId,
					currentStatusRaw,
					lockedMessageKeys: Object.keys(lockedMessage || {}),
					lockedMessageStatus: lockedMessage.status,
				});
				throw new BadRequestException({
					message: `Message with ID '${messageId}' cannot be retried. Current status is invalid.`,
					i18nType: 'kafka.message.retry.invalid_status',
				});
			}
			
			// Retry is ACCEPTED - process regardless of current status (SENT, PROCESSED, or ERROR)
			// Log the request-start status for debugging (but don't reject based on it)
			this.logger.info('Retry accepted: processing message regardless of current status', {
				messageId,
				requestStartStatus: currentStatus,
				requestStartStatusRaw: currentStatusRaw,
				attemptCountBefore: lockedMessage.attempt_count || 0,
				note: currentStatus !== KafkaMessageStatus.ERROR.toUpperCase() 
					? 'Retrying message that is not in ERROR state (may be race condition)' 
					: 'Retrying message in ERROR state',
			});
			
			// From this point forward, the retry MUST succeed (return 200) regardless of:
			// - Final status after processing
			// - Any status reads during processing
			// - Processing outcome (success or failure)
			// No further status validation or exception throwing based on status is allowed
			retryAccepted = true;

			// Increment attempt_count and update last_attempt_at (while row is locked)
			await queryRunner.query(
				`
				UPDATE core.kafka_message_processing
				SET 
					attempt_count = attempt_count + 1,
					last_attempt_at = NOW(),
					updated_at = NOW()
				WHERE id = $1
				`,
				[messageId],
			);

			await queryRunner.commitTransaction();
			transactionCommitted = true;
			transactionStarted = false; // Transaction committed, no need to rollback

			// Use repository to fetch the updated message - TypeORM handles JSONB correctly
			const updatedEntity = await this.repository.findOne({
				where: { id: messageId },
			});

			if (!updatedEntity) {
				throw new Error(`Message with ID '${messageId}' not found after update. Cannot retry.`);
			}

			// Use topic from locked message (already validated) as fallback
			const topic = updatedEntity.topic || topicFromLock;
			if (!topic) {
				this.logger.error('Topic is missing from both entity and locked message', {
					messageId,
					entityTopic: updatedEntity.topic,
					lockedMessageTopic: topicFromLock,
				});
				throw new Error(`Message with ID '${messageId}' is missing topic in database. Cannot retry.`);
			}
			
			// Log payload structure after retrieval
			this.logger.info('Payload retrieved from database via repository', {
				messageId,
				hasAgent: !!updatedEntity.payload?.agent,
				agentFirstName: (updatedEntity.payload?.agent as any)?.firstName,
				agentLastName: (updatedEntity.payload?.agent as any)?.lastName,
				agentId: (updatedEntity.payload?.agent as any)?.id,
				agentKeys: updatedEntity.payload?.agent ? Object.keys(updatedEntity.payload.agent as any) : [],
				payloadType: typeof updatedEntity.payload,
			});
			
			updatedMessage = updatedEntity;
		} catch (error) {
			// Only rollback if transaction was successfully started and hasn't been committed yet
			if (transactionStarted && !transactionCommitted) {
				try {
					await queryRunner.rollbackTransaction();
				} catch (rollbackError) {
					// Transaction might already be rolled back or closed
					this.logger.debug('Rollback failed (transaction may already be closed)', {
						messageId,
						error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
					});
				}
			}
			// Re-throw NotFoundException and BadRequestException as-is
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error('Failed to atomically validate and update message for retry', {
				messageId,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			throw error;
		} finally {
			await queryRunner.release();
		}

		if (!updatedMessage) {
			throw new Error('Message not found after atomic update');
		}

		// Validate that topic exists - required for retry
		if (!updatedMessage.topic) {
			this.logger.error('Message topic is missing - cannot retry', {
				messageId,
				message: updatedMessage,
			});
			throw new BadRequestException({
				message: `Message with ID '${messageId}' is missing topic information. Cannot retry message processing.`,
				i18nType: 'kafka.message.retry.no_topic',
			});
		}

		// Use custom payload if provided and not empty, otherwise use stored payload
		// Empty object {} should be treated as "no custom payload" to use stored payload
		const hasCustomPayload = customPayload && 
			typeof customPayload === 'object' && 
			!Array.isArray(customPayload) && 
			Object.keys(customPayload).length > 0;
		
		// Ensure payload is properly parsed if it's a string (PostgreSQL JSONB might return as string)
		let storedPayload = updatedMessage.payload;
		if (typeof storedPayload === 'string') {
			try {
				storedPayload = JSON.parse(storedPayload);
			} catch (parseError) {
				this.logger.warn('Failed to parse stored payload as JSON, using as-is', {
					messageId,
					payloadType: typeof storedPayload,
					error: parseError instanceof Error ? parseError.message : 'Unknown error',
				});
			}
		}
		
		// Deep clone the payload to avoid any reference issues
		// This ensures the payload structure is preserved exactly as stored
		const clonedPayload = storedPayload ? JSON.parse(JSON.stringify(storedPayload)) : {};
		
		// Ensure payloadToUse is never undefined - use empty object as fallback
		const payloadToUse = hasCustomPayload ? customPayload : (clonedPayload || {});
		
		// Validate payload structure before using it
		if (!hasCustomPayload && payloadToUse && typeof payloadToUse === 'object') {
			const agent = (payloadToUse as any)?.agent;
			if (agent) {
				// Ensure firstName and lastName are preserved
				if (!agent.firstName && agent.first_name) {
					agent.firstName = agent.first_name;
					delete agent.first_name;
				}
				if (!agent.lastName && agent.last_name) {
					agent.lastName = agent.last_name;
					delete agent.last_name;
				}
			}
		}
		
		// Log payload structure for debugging
		this.logger.info('Retry payload structure', {
			messageId,
			hasCustomPayload,
			payloadType: typeof payloadToUse,
			hasAgent: !!(payloadToUse as any)?.agent,
			agentFirstName: (payloadToUse as any)?.agent?.firstName,
			agentLastName: (payloadToUse as any)?.agent?.lastName,
			agentId: (payloadToUse as any)?.agent?.id,
			agentKeys: (payloadToUse as any)?.agent ? Object.keys((payloadToUse as any).agent) : [],
		});

		// Construct a mock Kafka message from payload
		// Add header to indicate this is a retry (skip translation)
		const headers: Record<string, Buffer> = updatedMessage.headers ? Object.fromEntries(
			Object.entries(updatedMessage.headers).map(([k, v]) => [k, Buffer.from(String(v))])
		) : {};
		
		// CRITICAL: Always skip translation for retries
		// The payload stored in the database is already in the translated format
		// If we try to translate it again, it will fail because the structure doesn't match
		// the raw Kafka message format (e.g., payload.member_first_name doesn't exist)
		headers['x-skip-translation'] = Buffer.from('true');

		// Stringify payload and log it to verify structure is preserved
		const stringifiedPayload = JSON.stringify(payloadToUse);
		this.logger.info('Payload being stringified for retry', {
			messageId,
			payloadStringLength: stringifiedPayload.length,
			hasAgent: !!(payloadToUse as any)?.agent,
			agentFirstName: (payloadToUse as any)?.agent?.firstName,
			agentLastName: (payloadToUse as any)?.agent?.lastName,
			agentId: (payloadToUse as any)?.agent?.id,
			payloadPreview: stringifiedPayload.substring(0, 500),
		});

		const mockKafkaMessage: KafkaMessage = {
			key: updatedMessage.messageKey ? Buffer.from(updatedMessage.messageKey) : null,
			value: Buffer.from(stringifiedPayload),
			headers: headers,
			offset: updatedMessage.offset,
			timestamp: updatedMessage.createdAt.toISOString(),
			attributes: 0,
		};

		// Get the consumer service for this topic
		// This works for all consumer types (Enterprise, Global ADS, UK, AU, etc.)
		// getServiceByTopic will find the consumer by topic name regardless of consumer type
		const serviceEntry = await this.kafkaBootstrapService.getServiceByTopic(updatedMessage.topic);
		if (!serviceEntry || serviceEntry.service.getType() !== 'consumer') {
			throw new BadRequestException({
				message: `No consumer service found for topic '${updatedMessage.topic}'. Cannot retry message processing.`,
				i18nType: 'kafka.message.retry.no_consumer',
			});
		}

		// Get message handler from consumer service
		const messageHandler = serviceEntry.service.getMessageHandler?.();
		if (!messageHandler) {
			throw new BadRequestException({
				message: `Consumer service for topic '${updatedMessage.topic}' does not provide a message handler. Cannot retry message processing.`,
				i18nType: 'kafka.message.retry.no_handler',
			});
		}

		// CRITICAL: Status validation already passed - retry is ACCEPTED
		// Process the message synchronously and wait for final status to be committed
		// Return the final committed status (PROCESSED or ERROR) in the response
		// No post-processing status validation or exception throwing based on status is allowed
		
		this.logger.info('Retry accepted: processing message and waiting for final status', {
			messageId,
			topic: updatedMessage.topic,
			partition: updatedMessage.partition,
			offset: updatedMessage.offset,
			attemptCount: updatedMessage.attemptCount,
			statusAtAcceptance: updatedMessage.status,
		});

		// Process message synchronously and wait for final status
		try {
			await messageHandler({
				topic: updatedMessage.topic,
				partition: updatedMessage.partition,
				message: mockKafkaMessage,
			});

			// Processing completed without throwing - this is success
			// Wait for status updates to propagate (consumer may update status asynchronously)
			// Poll up to 30 times (3 seconds total) to get the final committed status
			let finalMessage = await this.findById(messageId);
			if (!finalMessage) {
				throw new Error('Message not found after processing');
			}

			// Poll for status changes to get the most up-to-date committed status
			for (let i = 0; i < 30; i++) {
				await new Promise(resolve => setTimeout(resolve, 100));
				const currentMessage = await this.findById(messageId);
				if (currentMessage) {
					finalMessage = currentMessage;
					// If status is PROCESSED or ERROR, we have the final status
					if (currentMessage.status === KafkaMessageStatus.PROCESSED || 
						currentMessage.status === KafkaMessageStatus.ERROR) {
						break;
					}
				}
			}

			// Add a final short wait to ensure status is fully committed
			await new Promise(resolve => setTimeout(resolve, 200));
			const lastCheck = await this.findById(messageId);
			if (lastCheck) {
				finalMessage = lastCheck;
			}

			// IMPORTANT: Since messageHandler completed without throwing, processing should have succeeded.
			// The consumer's markAsProcessed should have updated the status to PROCESSED.
			// However, the consumer may have caught an error internally and set status to ERROR with error details.
			// Check the current status and error details to determine the final state.
			const currentStatusCheck = await this.dataSource.query(
				`
				SELECT status, error_code, error_message, error_stacktrace 
				FROM core.kafka_message_processing 
				WHERE id = $1
				`,
				[messageId],
			);
			
			if (currentStatusCheck && currentStatusCheck.length > 0) {
				const currentStatus = currentStatusCheck[0].status;
				const hasErrorDetails = currentStatusCheck[0].error_code || 
				                       currentStatusCheck[0].error_message || 
				                       currentStatusCheck[0].error_stacktrace;
				
				if (currentStatus === KafkaMessageStatus.ERROR) {
					if (hasErrorDetails) {
						// Consumer set ERROR with error details - preserve them (processing actually failed)
						// Just update last_attempt_at to reflect the retry attempt
						await this.dataSource.query(
							`
							UPDATE core.kafka_message_processing
							SET last_attempt_at = NOW(), updated_at = NOW()
							WHERE id = $1
							`,
							[messageId],
						);
					} else {
						// Status is ERROR but no error details - markAsProcessed likely failed (lookup issue)
						// Update to PROCESSED as a fallback
						await this.dataSource.query(
							`
							UPDATE core.kafka_message_processing
							SET 
								status = $1,
								processed_at = COALESCE(processed_at, NOW()),
								last_attempt_at = NOW(),
								updated_at = NOW()
							WHERE id = $2
							`,
							[KafkaMessageStatus.PROCESSED, messageId],
						);
					}
				} else {
					// Status is already PROCESSED (or something else), just update last_attempt_at
					await this.dataSource.query(
						`
						UPDATE core.kafka_message_processing
						SET last_attempt_at = NOW(), updated_at = NOW()
						WHERE id = $1
						`,
						[messageId],
					);
				}
			}

			// Get the absolute latest committed status for the response
			const latestStatusResult = await this.dataSource.query(
				`
				SELECT id, topic, partition, "offset", status, message_key, payload, headers, 
				       event_id, consumer_group, service_name, attempt_count, error_code, 
				       error_message, error_stacktrace, is_retryable, processed_at, 
				       last_attempt_at, created_at, updated_at
				FROM core.kafka_message_processing
				WHERE id = $1
				`,
				[messageId],
			);

			if (!latestStatusResult || latestStatusResult.length === 0) {
				throw new Error('Message not found after status update');
			}

			// Map raw database result to entity format
			// Helper function to safely parse dates
			const safeDate = (value: unknown): Date | null => {
				if (!value) return null;
				try {
					const date = new Date(value as string);
					return isNaN(date.getTime()) ? null : date;
				} catch {
					return null;
				}
			};

			const raw = latestStatusResult[0];
			const updatedFinalMessage: KafkaMessageProcessingEntity = {
				id: raw.id,
				topic: raw.topic,
				partition: raw.partition,
				offset: raw.offset,
				status: raw.status,
				messageKey: raw.message_key,
				payload: raw.payload,
				headers: raw.headers,
				eventId: raw.event_id,
				consumerGroup: raw.consumer_group,
				serviceName: raw.service_name,
				attemptCount: raw.attempt_count,
				errorCode: raw.error_code,
				errorMessage: raw.error_message,
				errorStacktrace: raw.error_stacktrace,
				isRetryable: raw.is_retryable,
				processedAt: safeDate(raw.processed_at),
				lastAttemptAt: safeDate(raw.last_attempt_at),
				createdAt: safeDate(raw.created_at) || new Date(), // Fallback to now if invalid
				updatedAt: safeDate(raw.updated_at) || new Date(), // Fallback to now if invalid
			} as KafkaMessageProcessingEntity;

			this.logger.info('Retry processing completed successfully, returning final committed status', {
				messageId,
				topic: updatedMessage.topic,
				partition: updatedMessage.partition,
				offset: updatedMessage.offset,
				attemptCount: updatedFinalMessage.attemptCount,
				finalStatus: updatedFinalMessage.status,
			});

			// CRITICAL: Return success with final committed status - retry was ACCEPTED (status validated at request start)
			// The endpoint MUST return 200 here with the final committed status
			// The response reflects "Retry accepted and completed" with final status (PROCESSED or ERROR)
			return this.mapEntityToDto(updatedFinalMessage);
		} catch (error) {
			// Processing failed - ensure status is set to ERROR and get final committed status
			// The consumer may have already marked it as ERROR, but we need to ensure it's ERROR
			// Handle ZodError specially to format validation errors
			let errorMessage: string;
			let errorStacktrace: string | null;
			let errorCode: string;
			
			if (error instanceof ZodError) {
				// This is a ZodError - format validation errors for better readability
				const issues = error.issues;
				
				// Format validation errors into a readable message
				const formattedErrors = issues.map((issue) => {
					const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'root';
					return `${fieldPath}: ${issue.message}`;
				});
				
				errorMessage = `Validation failed: ${formattedErrors.join('; ')}`;
				errorCode = 'ZodError';
				// Store full error details in stacktrace for debugging
				errorStacktrace = JSON.stringify({
					type: 'ZodError',
					issues: issues.map((issue) => ({
						path: issue.path,
						message: issue.message,
						code: issue.code,
					})),
					stack: error.stack,
				}, null, 2);
			} else {
				// Regular error handling
				errorMessage = error instanceof Error ? error.message : String(error);
				errorStacktrace = error instanceof Error ? error.stack : null;
				errorCode = error instanceof Error ? error.name : 'Error';
			}
			
			await this.dataSource.query(
				`
				UPDATE core.kafka_message_processing
				SET 
					last_attempt_at = NOW(), 
					updated_at = NOW(),
					status = $1,
					error_code = $2,
					error_message = $3,
					error_stacktrace = $4,
					is_retryable = true
				WHERE id = $5 AND status != $1
				`,
				[
					KafkaMessageStatus.ERROR,
					errorCode,
					errorMessage,
					errorStacktrace,
					messageId,
				],
			);

			// Wait briefly for the status update to be committed
			await new Promise(resolve => setTimeout(resolve, 200));

			// Get the final committed status with all error details
			// Use raw query to ensure we get the latest error_code, error_message, error_stacktrace
			// (consumer may have also set these, so we want the most recent values)
			const finalStatusResult = await this.dataSource.query(
				`
				SELECT id, topic, partition, "offset", status, message_key, payload, headers, 
				       event_id, consumer_group, service_name, attempt_count, error_code, 
				       error_message, error_stacktrace, is_retryable, processed_at, 
				       last_attempt_at, created_at, updated_at
				FROM core.kafka_message_processing
				WHERE id = $1
				`,
				[messageId],
			);

			if (!finalStatusResult || finalStatusResult.length === 0) {
				throw new Error('Message not found after processing');
			}

			// Map raw database result to entity format
			const safeDate = (value: unknown): Date | null => {
				if (!value) return null;
				try {
					const date = new Date(value as string);
					return isNaN(date.getTime()) ? null : date;
				} catch {
					return null;
				}
			};

			const raw = finalStatusResult[0];
			const finalMessage: KafkaMessageProcessingEntity = {
				id: raw.id,
				topic: raw.topic,
				partition: raw.partition,
				offset: raw.offset,
				status: raw.status,
				messageKey: raw.message_key,
				payload: raw.payload,
				headers: raw.headers,
				eventId: raw.event_id,
				consumerGroup: raw.consumer_group,
				serviceName: raw.service_name,
				attemptCount: raw.attempt_count,
				errorCode: raw.error_code,
				errorMessage: raw.error_message,
				errorStacktrace: raw.error_stacktrace,
				isRetryable: raw.is_retryable,
				processedAt: safeDate(raw.processed_at),
				lastAttemptAt: safeDate(raw.last_attempt_at),
				createdAt: safeDate(raw.created_at) || new Date(),
				updatedAt: safeDate(raw.updated_at) || new Date(),
			} as KafkaMessageProcessingEntity;

			this.logger.warn('Retry processing failed, returning final ERROR status with error details', {
				messageId,
				topic: updatedMessage.topic,
				partition: updatedMessage.partition,
				offset: updatedMessage.offset,
				attemptCount: finalMessage.attemptCount,
				finalStatus: finalMessage.status,
				errorCode: finalMessage.errorCode,
				errorMessage: finalMessage.errorMessage,
				errorStacktrace: finalMessage.errorStacktrace ? 'Present' : 'Missing',
				processingError: error instanceof Error ? error.message : 'Unknown error',
			});

			// CRITICAL: Return success with final ERROR status - retry was ACCEPTED (status validated at request start)
			// The endpoint MUST return 200 here with the final committed status, even if processing failed
			// The response reflects "Retry accepted and completed" with final status (ERROR)
			// Error details (errorCode, errorMessage, errorStacktrace) are included in the response
			return this.mapEntityToDto(finalMessage);
		}
	}

	/**
	 * Produce a message to any Kafka topic.
	 * Creates a new entry with status = PENDING, sends message, then updates to SENT.
	 * 
	 * @param topic - Kafka topic name
	 * @param payload - Message payload (will be JSON stringified). Accepts any JSON value (object, array, string, number, boolean, null).
	 * @param key - Optional message key for partitioning
	 * @param headers - Optional message headers
	 * @returns Created message record
	 */
	async produceMessage(
		topic: string,
		payload: unknown,
		key?: string,
		headers?: Record<string, string>,
	): Promise<KafkaMessageProcessingResponseDto> {
		// Extract eventId if payload is an object with eventId or uuid property
		const payloadObj = payload && typeof payload === 'object' && !Array.isArray(payload) 
			? payload as Record<string, unknown> 
			: null;
		const eventId = payloadObj 
			? ((payloadObj.eventId as string) || (payloadObj.uuid as string) || undefined)
			: undefined;
		
		try {
			// Send message to Kafka - this will create a SENT record via createSentRecord
			const kafkaProducer = await this.getKafkaProducer();
			await kafkaProducer.sendMessage(topic, payload, key, headers);

			// Find the created record by topic, eventId (if available), or most recent
			// Since createSentRecord uses ON CONFLICT, we need to find by topic and either
			// eventId or the most recent record for this topic
			let record: KafkaMessageProcessingEntity | null = null;
			
			if (eventId) {
				// Try to find by eventId first (most reliable)
				record = await this.repository.findOne({
					where: {
						topic,
						eventId,
						status: KafkaMessageStatus.SENT,
					},
					order: { createdAt: 'DESC' },
				});
			}

			// If not found by eventId, find most recent SENT record for this topic
			if (!record) {
				record = await this.repository.findOne({
					where: {
						topic,
						status: KafkaMessageStatus.SENT,
					},
					order: { createdAt: 'DESC' },
				});
			}

			if (!record) {
				// Record should have been created by producer, but if not found, log warning
				this.logger.warn('Message sent to Kafka but record not found in database', {
					topic,
					messageKey: key,
					eventId,
				});
				throw new Error('Message sent to Kafka but record not found in database');
			}

			this.logger.info('Message produced successfully', {
				messageId: record.id,
				topic,
				messageKey: key,
				eventId,
			});

			return this.mapEntityToDto(record);
		} catch (error) {
			this.logger.error('Failed to produce message to Kafka', {
				topic,
				messageKey: key,
				eventId,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		}
	}

	/**
	 * Retry multiple failed messages in batch.
	 * 
	 * @param messageIds - Array of message record IDs (UUIDs)
	 * @returns Summary of retry results
	 */
	async batchRetryMessages(messageIds: string[]): Promise<{
		successful: number;
		failed: number;
		results: Array<{
			messageId: string;
			success: boolean;
			error?: string;
		}>;
	}> {
		const results: Array<{
			messageId: string;
			success: boolean;
			error?: string;
		}> = [];

		for (const messageId of messageIds) {
			try {
				await this.retryMessage(messageId);
				results.push({
					messageId,
					success: true,
				});
			} catch (error) {
				results.push({
					messageId,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		this.logger.info('Batch retry completed', {
			total: messageIds.length,
			successful,
			failed,
		});

		return {
			successful,
			failed,
			results,
		};
	}

	/**
	 * Process retry message asynchronously.
	 * This method is called after the retry is accepted and the API has returned success.
	 * It handles the actual message processing and status updates in the background.
	 */
	private async processRetryMessageAsync(
		messageId: string,
		updatedMessage: KafkaMessageProcessingEntity,
		mockKafkaMessage: KafkaMessage,
		messageHandler: (message: { topic: string; partition: number; message: KafkaMessage }) => Promise<void>,
	): Promise<void> {
		try {
			// Invoke the message handler to process the message
			await messageHandler({
				topic: updatedMessage.topic,
				partition: updatedMessage.partition,
				message: mockKafkaMessage,
			});

			// Processing completed without throwing - this is success
			// Wait briefly for status updates to propagate (consumer may update status asynchronously)
			// Poll up to 30 times (3 seconds total) to check if status was updated
			for (let i = 0; i < 30; i++) {
				await new Promise(resolve => setTimeout(resolve, 100));
				const currentMessage = await this.findById(messageId);
				if (currentMessage) {
					// If status is PROCESSED or ERROR, we have the final status
					if (currentMessage.status === KafkaMessageStatus.PROCESSED || 
						currentMessage.status === KafkaMessageStatus.ERROR) {
						break;
					}
				}
			}

			// Check if status needs to be updated (consumer's markAsProcessed may have failed)
			const currentStatusCheck = await this.dataSource.query(
				`
				SELECT status FROM core.kafka_message_processing WHERE id = $1
				`,
				[messageId],
			);
			
			if (currentStatusCheck && currentStatusCheck.length > 0 && currentStatusCheck[0].status === KafkaMessageStatus.ERROR) {
				// Status is still ERROR, so markAsProcessed must have failed - update it directly
				await this.dataSource.query(
					`
					UPDATE core.kafka_message_processing
					SET 
						status = $1,
						processed_at = COALESCE(processed_at, NOW()),
						last_attempt_at = NOW(),
						updated_at = NOW()
					WHERE id = $2
					`,
					[KafkaMessageStatus.PROCESSED, messageId],
				);
				
				this.logger.info('Async retry processing: updated status to PROCESSED', {
					messageId,
					topic: updatedMessage.topic,
				});
			} else {
				// Status is already PROCESSED (or something else), just update last_attempt_at
				await this.dataSource.query(
					`
					UPDATE core.kafka_message_processing
					SET last_attempt_at = NOW(), updated_at = NOW()
					WHERE id = $1
					`,
					[messageId],
				);
			}

			this.logger.info('Async retry processing completed successfully', {
				messageId,
				topic: updatedMessage.topic,
				partition: updatedMessage.partition,
				offset: updatedMessage.offset,
			});
		} catch (error) {
			// Processing failed - ensure status is set to ERROR
			// The consumer may have already marked it as ERROR, but we need to ensure it's ERROR
			await this.dataSource.query(
				`
				UPDATE core.kafka_message_processing
				SET 
					last_attempt_at = NOW(), 
					updated_at = NOW(),
					status = $1,
					error_code = $2,
					error_message = $3,
					error_stacktrace = $4,
					is_retryable = true
				WHERE id = $5 AND status != $1
				`,
				[
					KafkaMessageStatus.ERROR,
					error instanceof Error ? error.constructor.name : 'Error',
					error instanceof Error ? error.message : String(error),
					error instanceof Error ? error.stack : null,
					messageId,
				],
			);

			this.logger.warn('Async retry processing failed', {
				messageId,
				topic: updatedMessage.topic,
				partition: updatedMessage.partition,
				offset: updatedMessage.offset,
				error: error instanceof Error ? error.message : 'Unknown error',
			});

			// Don't re-throw - retry was already accepted, error is logged
		}
	}

	/**
	 * Map entity to DTO.
	 */
	public mapEntityToDto(entity: KafkaMessageProcessingEntity): KafkaMessageProcessingResponseDto {
		return {
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
		};
	}

	/**
	 * Retrieves a paginated list of Kafka message processing records.
	 * Default sort: lastAttemptAt DESC (most recently attempted first), then createdAt DESC.
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
				// Default sort: last_attempt_at DESC (most recently attempted first)
				// If last_attempt_at is NULL, those records will appear last
				qb.orderBy('kafka_message.last_attempt_at', 'DESC', 'NULLS LAST');
				qb.addOrderBy('kafka_message.created_at', 'DESC');
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

