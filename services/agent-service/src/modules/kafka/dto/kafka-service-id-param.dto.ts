import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for Kafka service ID path parameter.
 * Used for OpenAPI documentation.
 */
export class KafkaServiceIdParamDto {
	@ApiProperty({
		description: 'Kafka service ID (UUID from database)',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	id!: string;
}

