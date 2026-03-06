import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

/**
 * DTO for batch retry request.
 */
export class BatchRetryRequestDto {
	@ApiProperty({
		description: 'Array of message IDs to retry',
		example: ['550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
		type: [String],
	})
	@IsArray()
	@IsUUID('4', { each: true })
	messageIds!: string[];
}





