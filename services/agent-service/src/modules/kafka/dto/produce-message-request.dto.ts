import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for producing a message to a Kafka topic.
 * 
 * NOTE: No class-validator decorators - validation happens in service layer.
 * This DTO is used only for TypeScript typing and Swagger documentation.
 * The payload field accepts any JSON structure depending on the Kafka topic.
 */
export class ProduceMessageRequestDto {
	@ApiProperty({
		description: 'Kafka topic name',
		example: 'Global_SMS_SponsorChanged_V2',
		type: String,
	})
	topic!: string;

	@ApiProperty({
		description: 'Message payload (any JSON value). Structure varies by topic - accepts any valid JSON value (object, array, string, number, boolean, null).',
		example: { applicantUuid: '123', sponsorUuid: '456' },
		// Use Object type with additionalProperties to accept any structure
		// This allows objects, arrays, primitives, and null
		type: Object,
		additionalProperties: true,
		required: false,
	})
	payload?: unknown;

	@ApiProperty({
		description: 'Optional message key for partitioning',
		example: 'agent-123',
		required: false,
		type: String,
	})
	key?: string;

	@ApiProperty({
		description: 'Optional message headers',
		example: { 'correlation-id': 'abc-123' },
		required: false,
		type: Object,
		additionalProperties: { type: 'string' },
	})
	headers?: Record<string, string>;
}

