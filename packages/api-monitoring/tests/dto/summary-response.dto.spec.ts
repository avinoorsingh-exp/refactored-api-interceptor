import { SummaryResponseDto } from '../../src/dto/summary-response.dto.js';

describe('SummaryResponseDto', () => {
	it('should create instance with all properties', () => {
		const dto = new SummaryResponseDto();
		dto.totalRequests = 12500;
		dto.errorRate = 0.02;
		dto.p95Latency = 245;
		dto.activeActors = 150;
		dto.activeRateLimitViolations = 5;

		expect(dto.totalRequests).toBe(12500);
		expect(dto.errorRate).toBe(0.02);
		expect(dto.p95Latency).toBe(245);
		expect(dto.activeActors).toBe(150);
		expect(dto.activeRateLimitViolations).toBe(5);
	});

	it('should handle zero values', () => {
		const dto = new SummaryResponseDto();
		dto.totalRequests = 0;
		dto.errorRate = 0;
		dto.p95Latency = 0;
		dto.activeActors = 0;
		dto.activeRateLimitViolations = 0;

		expect(dto.totalRequests).toBe(0);
		expect(dto.errorRate).toBe(0);
		expect(dto.p95Latency).toBe(0);
		expect(dto.activeActors).toBe(0);
		expect(dto.activeRateLimitViolations).toBe(0);
	});

	it('should handle high values', () => {
		const dto = new SummaryResponseDto();
		dto.totalRequests = 1000000;
		dto.errorRate = 1.0;
		dto.p95Latency = 5000;
		dto.activeActors = 10000;
		dto.activeRateLimitViolations = 1000;

		expect(dto.totalRequests).toBe(1000000);
		expect(dto.errorRate).toBe(1.0);
		expect(dto.p95Latency).toBe(5000);
		expect(dto.activeActors).toBe(10000);
		expect(dto.activeRateLimitViolations).toBe(1000);
	});
});

