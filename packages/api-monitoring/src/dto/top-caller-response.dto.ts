import { ApiProperty } from '@nestjs/swagger';

/**
 * Top caller statistics DTO.
 * 
 * @public
 */
export class TopCallerResponseDto {
	/**
	 * Actor ID (UUID).
	 */
	@ApiProperty({
		description: 'Actor ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	actorId!: string;

	/**
	 * Actor type.
	 */
	@ApiProperty({
		description: 'Actor type',
		example: 'USER',
	})
	actorType!: string;

	/**
	 * Total number of requests.
	 */
	@ApiProperty({
		description: 'Total number of requests',
		example: 1250,
	})
	requestCount!: number;

	/**
	 * Number of requests that resulted in errors.
	 */
	@ApiProperty({
		description: 'Number of requests that resulted in errors',
		example: 15,
	})
	errorCount!: number;
}

