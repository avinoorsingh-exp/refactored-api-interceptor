import { ApiProperty } from '@nestjs/swagger';
import { KafkaMessageStatus } from '@exprealty/database';

/**
 * DTO for Kafka message processing response.
 * Used for API responses.
 */
export class KafkaMessageProcessingResponseDto {
	@ApiProperty({
		description: 'Record ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;

	@ApiProperty({
		description: 'Kafka topic name',
		example: 'Enterprise_AgentUpdated_V2',
	})
	topic!: string;

	@ApiProperty({
		description: 'Kafka partition number',
		example: 0,
	})
	partition!: number;

	@ApiProperty({
		description: 'Kafka message offset',
		example: '12345',
	})
	offset!: string;

	@ApiProperty({
		description: 'Kafka message key (optional)',
		example: 'agent-123',
		required: false,
	})
	messageKey?: string;

	@ApiProperty({
		description: 'Event ID for correlation (optional)',
		example: 'event-456',
		required: false,
	})
	eventId?: string;

	@ApiProperty({
		description: 'Processing status',
		enum: KafkaMessageStatus,
		example: KafkaMessageStatus.PROCESSED,
	})
	status!: KafkaMessageStatus;

	@ApiProperty({
		description: 'Number of processing attempts',
		example: 1,
	})
	attemptCount!: number;

	@ApiProperty({
		description: 'Timestamp of last processing attempt',
		example: '2024-01-15T08:30:00.000Z',
		required: false,
	})
	lastAttemptAt?: Date;

	@ApiProperty({
		description: 'Timestamp when message was successfully processed',
		example: '2024-01-15T08:30:00.000Z',
		required: false,
	})
	processedAt?: Date;

	@ApiProperty({
		description: 'Error code (if processing failed)',
		example: 'Error',
		required: false,
	})
	errorCode?: string;

	@ApiProperty({
		description: 'Error message (if processing failed)',
		example: 'Processing failed',
		required: false,
	})
	errorMessage?: string;

	@ApiProperty({
		description: 'Error stack trace (if processing failed)',
		example: 'Error: Processing failed\n    at ...',
		required: false,
	})
	errorStacktrace?: string;

	@ApiProperty({
		description: 'Whether the error is retryable',
		example: true,
		required: false,
	})
	isRetryable?: boolean;

	@ApiProperty({
		description: 'Whether the message has been dead lettered',
		example: false,
	})
	deadLettered!: boolean;

	@ApiProperty({
		description: 'Message payload (JSON)',
		example: { test: 'data' },
	})
	payload!: Record<string, unknown>;

	@ApiProperty({
		description: 'Message headers (JSON)',
		example: { 'x-correlation-id': 'test-correlation-id' },
		required: false,
	})
	headers?: Record<string, string>;

	@ApiProperty({
		description: 'Kafka consumer group name',
		example: 'agent-service-consumer-group',
	})
	consumerGroup!: string;

	@ApiProperty({
		description: 'Service name that processed the message',
		example: 'agent-service',
	})
	serviceName!: string;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2024-01-15T08:30:00.000Z',
	})
	createdAt!: Date;

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2024-01-15T08:30:00.000Z',
	})
	updatedAt!: Date;
}

