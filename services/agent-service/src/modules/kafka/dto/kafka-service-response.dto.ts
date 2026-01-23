import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KafkaServiceType } from '@exprealty/database';
import { KafkaServiceStatus } from '../kafka-runtime-manager.service.js';

/**
 * DTO for Kafka service response.
 * Used for API responses to represent a Kafka service with runtime state.
 */
export class KafkaServiceResponseDto {
	@ApiProperty({
		description: 'Runtime service ID (generated from service instance)',
		example: 'consumer-Enterprise_AgentUpdated_V2-agent-service-group',
	})
	id!: string;

	@ApiProperty({
		description: 'Database entity ID (UUID) - use this for start/stop/enable/disable operations',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	entityId!: string;

	@ApiProperty({
		description: 'Runtime service ID (same as id, included for clarity)',
		example: 'consumer-Enterprise_AgentUpdated_V2-agent-service-group',
	})
	serviceId!: string;

	@ApiProperty({
		description: 'Service type',
		enum: KafkaServiceType,
		example: KafkaServiceType.CONSUMER,
	})
	type!: KafkaServiceType;

	@ApiProperty({
		description: 'Kafka topic name',
		example: 'Enterprise_AgentUpdated_V2',
	})
	topic!: string;

	@ApiPropertyOptional({
		description: 'Consumer group ID (null for producers)',
		example: 'agent-service-group',
		nullable: true,
	})
	groupId?: string | null;

	@ApiProperty({
		description: 'Runtime status of the service',
		enum: KafkaServiceStatus,
		example: KafkaServiceStatus.RUNNING,
	})
	status!: KafkaServiceStatus;

	@ApiProperty({
		description: 'Whether the service is enabled in database (persistent state)',
		example: true,
	})
	enabled!: boolean;

	@ApiPropertyOptional({
		description: 'Timestamp when the service was started',
		example: '2024-01-15T08:30:00.000Z',
		format: 'date-time',
		nullable: true,
	})
	startedAt?: Date | null;

	@ApiPropertyOptional({
		description: 'Error message if the service is in error state',
		example: 'Connection failed',
		nullable: true,
	})
	error?: string | null;
}

