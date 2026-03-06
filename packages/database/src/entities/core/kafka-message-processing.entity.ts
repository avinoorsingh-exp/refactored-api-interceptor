import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';

/**
 * Kafka message processing status enum values.
 * @public
 */
export enum KafkaMessageStatus {
	SENT = 'SENT',
	PROCESSED = 'PROCESSED',
	ERROR = 'ERROR',
	RETRYING = 'RETRYING',
}

/**
 * TypeORM entity for kafka_message_processing table.
 * Tracks Kafka message processing status, retries, errors, and idempotency.
 * 
 * Features:
 * - Unique constraint on (topic, partition, offset) for idempotency
 * - Automatic updated_at timestamp on state changes
 * - Helper methods for state management
 * 
 * @public
 */
@Entity({ name: 'kafka_message_processing', schema: 'core' })
@Index('idx_kafka_message_processing_topic_partition_offset', ['topic', 'partition', 'offset'], { unique: true })
export class KafkaMessageProcessingEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/**
	 * Kafka topic name.
	 * @public
	 */
	@Column({ type: 'text' })
	topic!: string;

	/**
	 * Kafka partition number.
	 * @public
	 */
	@Column({ type: 'integer' })
	partition!: number;

	/**
	 * Kafka message offset.
	 * @public
	 */
	@Column({ type: 'bigint' })
	offset!: string;

	/**
	 * Kafka message key (optional).
	 * @public
	 */
	@Column({ name: 'message_key', type: 'text', nullable: true })
	messageKey?: string;

	/**
	 * Event ID for correlation (optional).
	 * @public
	 */
	@Column({ name: 'event_id', type: 'text', nullable: true })
	eventId?: string;

	/**
	 * Processing status.
	 * @public
	 */
	@Column({
		type: 'text',
		default: KafkaMessageStatus.SENT,
	})
	status!: KafkaMessageStatus;

	/**
	 * Number of processing attempts.
	 * @public
	 */
	@Column({ name: 'attempt_count', type: 'integer', default: 0 })
	attemptCount!: number;

	/**
	 * Timestamp of last processing attempt.
	 * @public
	 */
	@Column({ name: 'last_attempt_at', type: 'timestamp with time zone', nullable: true })
	lastAttemptAt?: Date;

	/**
	 * Timestamp when message was successfully processed.
	 * @public
	 */
	@Column({ name: 'processed_at', type: 'timestamp with time zone', nullable: true })
	processedAt?: Date;

	/**
	 * Error code (if processing failed).
	 * @public
	 */
	@Column({ name: 'error_code', type: 'text', nullable: true })
	errorCode?: string;

	/**
	 * Error message (if processing failed).
	 * @public
	 */
	@Column({ name: 'error_message', type: 'text', nullable: true })
	errorMessage?: string;

	/**
	 * Error stack trace (if processing failed).
	 * @public
	 */
	@Column({ name: 'error_stacktrace', type: 'text', nullable: true })
	errorStacktrace?: string;

	/**
	 * Whether the error is retryable.
	 * @public
	 */
	@Column({ name: 'is_retryable', type: 'boolean', nullable: true })
	isRetryable?: boolean;

	/**
	 * Whether the message has been dead lettered.
	 * @public
	 */
	@Column({ name: 'dead_lettered', type: 'boolean', default: false })
	deadLettered!: boolean;

	/**
	 * Message payload (JSON).
	 * @public
	 */
	@Column({ type: 'jsonb' })
	payload!: Record<string, unknown>;

	/**
	 * Message headers (JSON).
	 * @public
	 */
	@Column({ type: 'jsonb', nullable: true })
	headers?: Record<string, string>;

	/**
	 * Kafka consumer group name.
	 * @public
	 */
	@Column({ name: 'consumer_group', type: 'text' })
	consumerGroup!: string;

	/**
	 * Service name that processed the message.
	 * @public
	 */
	@Column({ name: 'service_name', type: 'text' })
	serviceName!: string;

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	/**
	 * Last update timestamp.
	 * Automatically updated by TypeORM on save.
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;

	/**
	 * Mark the message as successfully processed.
	 * Updates status, processed_at, and clears error fields.
	 * @public
	 */
	markProcessed(): void {
		this.status = KafkaMessageStatus.PROCESSED;
		this.processedAt = new Date();
		this.lastAttemptAt = new Date();
		// Clear error fields
		this.errorCode = undefined;
		this.errorMessage = undefined;
		this.errorStacktrace = undefined;
		this.isRetryable = undefined;
		// updated_at will be automatically updated by @UpdateDateColumn
	}

	/**
	 * Mark the message as failed with an error.
	 * Updates status, error fields, and increments attempt count.
	 * 
	 * @param error - Error object or error message string
	 * @param retryable - Whether the error is retryable (default: true)
	 * @public
	 */
	markError(error: Error | string, retryable: boolean = true): void {
		this.status = KafkaMessageStatus.ERROR;
		this.lastAttemptAt = new Date();
		this.isRetryable = retryable;

		if (error instanceof Error) {
			this.errorMessage = error.message;
			this.errorStacktrace = error.stack;
			this.errorCode = error.name || 'Error';
		} else {
			this.errorMessage = error;
			this.errorStacktrace = undefined;
			this.errorCode = 'Error';
		}

		// Increment attempt count
		this.attemptCount += 1;
		// updated_at will be automatically updated by @UpdateDateColumn
	}

	/**
	 * Increment the attempt count and update last attempt timestamp.
	 * Used when retrying a message.
	 * @public
	 */
	incrementAttempt(): void {
		this.attemptCount += 1;
		this.lastAttemptAt = new Date();
		// updated_at will be automatically updated by @UpdateDateColumn
	}
}

