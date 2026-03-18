import { describe, it, expect } from '@jest/globals';
import {
	TrendsResponseDto,
	TrendBucketMetricsDto,
	TrendsKpiSummaryDto,
	PeriodDeltaDto,
} from '../../src/dto/trends-response.dto.js';
import { TimeBucket } from '@exprealty/shared-domain';

describe('TrendsResponseDto', () => {
	it('should create instance with buckets and kpiSummary', () => {
		const bucket = new TrendBucketMetricsDto();
		bucket.bucketStart = new Date('2024-01-01T00:00:00Z');
		bucket.requestCount = 1000;
		bucket.errorRate = 0.05;
		bucket.p95Latency = 250;
		bucket.latencyVariability = 150;

		const kpiSummary = new TrendsKpiSummaryDto();
		kpiSummary.avgRequestsPerDay = 5000;
		kpiSummary.overallErrorRate = 0.03;
		kpiSummary.avgP95Latency = 200;
		kpiSummary.avgLatencyVariability = 120;

		const dto = new TrendsResponseDto();
		dto.buckets = [bucket];
		dto.kpiSummary = kpiSummary;

		expect(dto.buckets).toHaveLength(1);
		expect(dto.buckets[0].requestCount).toBe(1000);
		expect(dto.kpiSummary.avgRequestsPerDay).toBe(5000);
	});

	it('should handle empty buckets array', () => {
		const kpiSummary = new TrendsKpiSummaryDto();
		kpiSummary.avgRequestsPerDay = 0;
		kpiSummary.overallErrorRate = 0;
		kpiSummary.avgP95Latency = 0;
		kpiSummary.avgLatencyVariability = 0;

		const dto = new TrendsResponseDto();
		dto.buckets = [];
		dto.kpiSummary = kpiSummary;

		expect(dto.buckets).toEqual([]);
	});

	it('should handle kpiSummary with deltas', () => {
		const delta = new PeriodDeltaDto();
		delta.absolute = 100;
		delta.percentage = 10.5;

		const kpiSummary = new TrendsKpiSummaryDto();
		kpiSummary.avgRequestsPerDay = 5000;
		kpiSummary.overallErrorRate = 0.03;
		kpiSummary.avgP95Latency = 200;
		kpiSummary.avgLatencyVariability = 120;
		kpiSummary.requestsPerDayDelta = delta;
		kpiSummary.errorRateDelta = delta;
		kpiSummary.p95LatencyDelta = delta;
		kpiSummary.latencyVariabilityDelta = delta;

		const dto = new TrendsResponseDto();
		dto.buckets = [];
		dto.kpiSummary = kpiSummary;

		expect(dto.kpiSummary.requestsPerDayDelta).toBe(delta);
		expect(dto.kpiSummary.requestsPerDayDelta?.absolute).toBe(100);
		expect(dto.kpiSummary.requestsPerDayDelta?.percentage).toBe(10.5);
	});

	it('should handle kpiSummary without deltas', () => {
		const kpiSummary = new TrendsKpiSummaryDto();
		kpiSummary.avgRequestsPerDay = 5000;
		kpiSummary.overallErrorRate = 0.03;
		kpiSummary.avgP95Latency = 200;
		kpiSummary.avgLatencyVariability = 120;

		const dto = new TrendsResponseDto();
		dto.buckets = [];
		dto.kpiSummary = kpiSummary;

		expect(dto.kpiSummary.requestsPerDayDelta).toBeUndefined();
		expect(dto.kpiSummary.errorRateDelta).toBeUndefined();
	});
});

describe('TrendBucketMetricsDto', () => {
	it('should create instance with all properties', () => {
		const dto = new TrendBucketMetricsDto();
		dto.bucketStart = new Date('2024-01-01T00:00:00Z');
		dto.requestCount = 1000;
		dto.errorRate = 0.05;
		dto.p95Latency = 250;
		dto.latencyVariability = 150;

		expect(dto.bucketStart).toEqual(new Date('2024-01-01T00:00:00Z'));
		expect(dto.requestCount).toBe(1000);
		expect(dto.errorRate).toBe(0.05);
		expect(dto.p95Latency).toBe(250);
		expect(dto.latencyVariability).toBe(150);
	});

	it('should handle zero values', () => {
		const dto = new TrendBucketMetricsDto();
		dto.bucketStart = new Date('2024-01-01T00:00:00Z');
		dto.requestCount = 0;
		dto.errorRate = 0;
		dto.p95Latency = 0;
		dto.latencyVariability = 0;

		expect(dto.requestCount).toBe(0);
		expect(dto.errorRate).toBe(0);
		expect(dto.p95Latency).toBe(0);
		expect(dto.latencyVariability).toBe(0);
	});
});

describe('PeriodDeltaDto', () => {
	it('should create instance with absolute and percentage', () => {
		const dto = new PeriodDeltaDto();
		dto.absolute = 100;
		dto.percentage = 10.5;

		expect(dto.absolute).toBe(100);
		expect(dto.percentage).toBe(10.5);
	});

	it('should handle negative values', () => {
		const dto = new PeriodDeltaDto();
		dto.absolute = -50;
		dto.percentage = -5.2;

		expect(dto.absolute).toBe(-50);
		expect(dto.percentage).toBe(-5.2);
	});

	it('should handle zero values', () => {
		const dto = new PeriodDeltaDto();
		dto.absolute = 0;
		dto.percentage = 0;

		expect(dto.absolute).toBe(0);
		expect(dto.percentage).toBe(0);
	});
});

describe('TrendsKpiSummaryDto', () => {
	it('should create instance with all properties', () => {
		const dto = new TrendsKpiSummaryDto();
		dto.avgRequestsPerDay = 5000;
		dto.overallErrorRate = 0.03;
		dto.avgP95Latency = 200;
		dto.avgLatencyVariability = 120;

		expect(dto.avgRequestsPerDay).toBe(5000);
		expect(dto.overallErrorRate).toBe(0.03);
		expect(dto.avgP95Latency).toBe(200);
		expect(dto.avgLatencyVariability).toBe(120);
	});

	it('should handle optional delta properties', () => {
		const delta = new PeriodDeltaDto();
		delta.absolute = 100;
		delta.percentage = 10.5;

		const dto = new TrendsKpiSummaryDto();
		dto.avgRequestsPerDay = 5000;
		dto.overallErrorRate = 0.03;
		dto.avgP95Latency = 200;
		dto.avgLatencyVariability = 120;
		dto.requestsPerDayDelta = delta;

		expect(dto.requestsPerDayDelta).toBe(delta);
		expect(dto.errorRateDelta).toBeUndefined();
	});
});

