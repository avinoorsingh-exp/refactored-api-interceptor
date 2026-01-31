import { describe, it, expect } from '@jest/globals';
import { AggregationResponseDto } from '../../src/dto/aggregation-response.dto.js';

describe('AggregationResponseDto', () => {
	it('should create instance with all properties', () => {
		const dto = new AggregationResponseDto();
		dto.aggregatedCount = 42;
		dto.startTime = '2024-01-01T00:00:00Z';
		dto.endTime = '2024-01-02T00:00:00Z';
		dto.timeBucket = 'hour';

		expect(dto.aggregatedCount).toBe(42);
		expect(dto.startTime).toBe('2024-01-01T00:00:00Z');
		expect(dto.endTime).toBe('2024-01-02T00:00:00Z');
		expect(dto.timeBucket).toBe('hour');
	});

	it('should handle zero aggregated count', () => {
		const dto = new AggregationResponseDto();
		dto.aggregatedCount = 0;
		dto.startTime = '2024-01-01T00:00:00Z';
		dto.endTime = '2024-01-01T01:00:00Z';
		dto.timeBucket = 'minute';

		expect(dto.aggregatedCount).toBe(0);
		expect(dto.timeBucket).toBe('minute');
	});

	it('should handle different time buckets', () => {
		const dto = new AggregationResponseDto();
		dto.aggregatedCount = 100;
		dto.startTime = '2024-01-01T00:00:00Z';
		dto.endTime = '2024-01-02T00:00:00Z';
		dto.timeBucket = 'day';

		expect(dto.timeBucket).toBe('day');
	});
});

