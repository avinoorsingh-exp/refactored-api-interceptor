import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for retry message request body (Swagger documentation only).
 * This DTO is NOT used for validation - the controller accepts `any` body.
 * 
 * Accepts either:
 * 1. A direct object (the payload itself) - for frontend convenience
 * 2. An object with a payload property - for explicit structure
 * 
 * The payload is optional - if not provided, the stored payload will be used.
 * 
 * NOTE: No validation decorators - validation happens in the service layer (Zod).
 */
export class RetryMessageRequestDto {
	@ApiProperty({
		description: 'Optional message payload to use for retry. If provided, this will be used instead of the stored payload. Translation will be skipped when using a custom payload. Can be sent directly as the body or wrapped in a "payload" property.',
		example: {
			eventId: '550e8400-e29b-41d4-a716-446655440000',
			agentId: 'agent-001',
			firstName: 'John',
			lastName: 'Doe',
		},
		required: false,
	})
	payload?: Record<string, unknown>;
}

