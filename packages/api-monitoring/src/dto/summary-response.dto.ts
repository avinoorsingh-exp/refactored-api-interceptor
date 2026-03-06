import { ApiProperty } from '@nestjs/swagger';

/**
 * Summary metrics response DTO.
 * 
 * @public
 */
export class SummaryResponseDto {
	/**
	 * Total number of requests in the time window.
	 */
	@ApiProperty({
		description: 'Total number of requests in the time window',
		example: 12500,
	})
	totalRequests!: number;

	/**
	 * Error rate (0.0 to 1.0).
	 */
	@ApiProperty({
		description: 'Error rate (0.0 to 1.0)',
		example: 0.02,
	})
	errorRate!: number;

	/**
	 * 95th percentile latency in milliseconds.
	 */
	@ApiProperty({
		description: '95th percentile latency in milliseconds',
		example: 245,
	})
	p95Latency!: number;

	/**
	 * Number of unique active actors in the time window.
	 */
	@ApiProperty({
		description: 'Number of unique active actors in the time window',
		example: 150,
	})
	activeActors!: number;

	/**
	 * Number of rate limit violations (429 status codes) in the time window.
	 */
	@ApiProperty({
		description: 'Number of rate limit violations (429 status codes) in the time window',
		example: 5,
	})
	activeRateLimitViolations!: number;
}

