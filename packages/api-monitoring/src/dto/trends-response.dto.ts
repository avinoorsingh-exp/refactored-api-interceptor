import { ApiProperty } from '@nestjs/swagger';

/**
 * Time-bucketed metrics for a single bucket.
 * @public
 */
export class TrendBucketMetricsDto {
	@ApiProperty({
		description: 'Start of the time bucket',
		example: '2024-01-01T00:00:00Z',
	})
	bucketStart!: Date;

	@ApiProperty({
		description: 'Total request count in this bucket',
		example: 1000,
	})
	requestCount!: number;

	@ApiProperty({
		description: 'Error rate (0.0 to 1.0)',
		example: 0.05,
	})
	errorRate!: number;

	@ApiProperty({
		description: '95th percentile latency in milliseconds',
		example: 250,
	})
	p95Latency!: number;

	@ApiProperty({
		description: 'Latency variability (p99 - p50) in milliseconds',
		example: 150,
	})
	latencyVariability!: number;
}

/**
 * Period-over-period delta comparison.
 * @public
 */
export class PeriodDeltaDto {
	@ApiProperty({
		description: 'Absolute change value',
		example: 100,
	})
	absolute!: number;

	@ApiProperty({
		description: 'Percentage change (can be negative)',
		example: 10.5,
	})
	percentage!: number;
}

/**
 * KPI summary for the trends period.
 * @public
 */
export class TrendsKpiSummaryDto {
	@ApiProperty({
		description: 'Average requests per day',
		example: 5000,
	})
	avgRequestsPerDay!: number;

	@ApiProperty({
		description: 'Overall error rate (0.0 to 1.0)',
		example: 0.03,
	})
	overallErrorRate!: number;

	@ApiProperty({
		description: 'Average p95 latency in milliseconds',
		example: 200,
	})
	avgP95Latency!: number;

	@ApiProperty({
		description: 'Average latency variability (p99 - p50) in milliseconds',
		example: 120,
	})
	avgLatencyVariability!: number;

	@ApiProperty({
		description: 'Period-over-period delta for requests per day',
		required: false,
		type: PeriodDeltaDto,
	})
	requestsPerDayDelta?: PeriodDeltaDto;

	@ApiProperty({
		description: 'Period-over-period delta for error rate',
		required: false,
		type: PeriodDeltaDto,
	})
	errorRateDelta?: PeriodDeltaDto;

	@ApiProperty({
		description: 'Period-over-period delta for p95 latency',
		required: false,
		type: PeriodDeltaDto,
	})
	p95LatencyDelta?: PeriodDeltaDto;

	@ApiProperty({
		description: 'Period-over-period delta for latency variability',
		required: false,
		type: PeriodDeltaDto,
	})
	latencyVariabilityDelta?: PeriodDeltaDto;
}

/**
 * Response DTO for trends metrics endpoint.
 * @public
 */
export class TrendsResponseDto {
	@ApiProperty({
		description: 'Time-bucketed metrics',
		type: [TrendBucketMetricsDto],
	})
	buckets!: TrendBucketMetricsDto[];

	@ApiProperty({
		description: 'KPI summary for the period',
		type: TrendsKpiSummaryDto,
	})
	kpiSummary!: TrendsKpiSummaryDto;
}

