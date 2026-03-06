import { ApiProperty } from '@nestjs/swagger';
import { KafkaServiceResponseDto } from './kafka-service-response.dto.js';

/**
 * DTO for Kafka service operation response.
 * Used for API responses to start/stop/enable/disable operations.
 */
export class KafkaServiceOperationResponseDto {
	@ApiProperty({
		description: 'Operation result message',
		example: 'Service started successfully',
	})
	message!: string;

	@ApiProperty({
		description: 'Updated service state',
		type: KafkaServiceResponseDto,
	})
	service!: KafkaServiceResponseDto;
}

