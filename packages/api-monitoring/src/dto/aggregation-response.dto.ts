import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for route stats aggregation endpoint.
 * @public
 */
export class AggregationResponseDto {
	@ApiProperty({
		description: 'Number of route stats records created',
		example: 42,
	})
	aggregatedCount!: number;

	@ApiProperty({
		description: 'Start time of the aggregation window',
		example: '2024-01-01T00:00:00Z',
	})
	startTime!: string;

	@ApiProperty({
		description: 'End time of the aggregation window',
		example: '2024-01-02T00:00:00Z',
	})
	endTime!: string;

	@ApiProperty({
		description: 'Time bucket used for aggregation',
		enum: ['minute', 'hour', 'day'],
		example: 'hour',
	})
	timeBucket!: string;
}


