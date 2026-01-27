import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ApiMonitoringController } from '../src/api-monitoring.controller.js';
import { ApiMetricsService } from '../src/services/api-metrics.service.js';
import { API_MONITORING_LOGGER_TOKEN } from '../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../src/interfaces/logger.interface.js';
import { ErrorSampleQueryDto } from '../src/dto/error-sample-query.dto.js';
import { ActorActivityQueryDto } from '../src/dto/actor-activity-query.dto.js';

describe('ApiMonitoringController - Pagination', () => {
	let controller: ApiMonitoringController;
	let metricsService: jest.Mocked<ApiMetricsService>;
	let logger: jest.Mocked<IApiMonitoringLogger>;

	beforeEach(async () => {
		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		} as any;

		metricsService = {
			getErrorSamples: jest.fn(),
			getActorActivity: jest.fn(),
			getTopCallers: jest.fn(),
			getSummary: jest.fn(),
		} as any;

		const module = await Test.createTestingModule({
			controllers: [ApiMonitoringController],
			providers: [
				{
					provide: ApiMetricsService,
					useValue: metricsService,
				},
				{
					provide: API_MONITORING_LOGGER_TOKEN,
					useValue: logger,
				},
			],
		}).compile();

		controller = module.get<ApiMonitoringController>(ApiMonitoringController);
	});

	describe('getErrorSamples', () => {
		it('should call service with pagination params', async () => {
			const query = new ErrorSampleQueryDto();
			query.startTime = new Date('2024-01-01T00:00:00Z');
			query.endTime = new Date('2024-01-02T00:00:00Z');
			query.limit = 50;
			query.cursor = 'test-cursor';

			metricsService.getErrorSamples = jest.fn().mockResolvedValue({
				data: [],
				pageInfo: { nextCursor: null, hasMore: false },
			});

			await controller.getErrorSamples(query);

			expect(metricsService.getErrorSamples).toHaveBeenCalledWith(
				expect.objectContaining({
					startTime: query.startTime,
					endTime: query.endTime,
					limit: 50,
					cursor: 'test-cursor',
				}),
			);
		});

		it('should handle legacyLimit for backward compatibility', async () => {
			const query = new ErrorSampleQueryDto();
			query.startTime = new Date('2024-01-01T00:00:00Z');
			query.endTime = new Date('2024-01-02T00:00:00Z');
			query.legacyLimit = 100;

			metricsService.getErrorSamples = jest.fn().mockResolvedValue([]);

			await controller.getErrorSamples(query);

			expect(metricsService.getErrorSamples).toHaveBeenCalledWith(
				expect.objectContaining({
					limit: 100,
				}),
			);
		});
	});

	describe('getActorActivity', () => {
		it('should call service with pagination params', async () => {
			const query = new ActorActivityQueryDto();
			query.actorId = 'actor-123';
			query.limit = 100;
			query.cursor = 'test-cursor';

			metricsService.getActorActivity = jest.fn().mockResolvedValue({
				data: [],
				pageInfo: { nextCursor: null, hasMore: false },
			});

			await controller.getActorActivity('actor-123', query);

			expect(metricsService.getActorActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: 'actor-123',
					limit: 100,
					cursor: 'test-cursor',
				}),
			);
		});
	});

	describe('getTopCallers', () => {
		it('should call service with pagination params', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-02T00:00:00Z');

			metricsService.getTopCallers = jest.fn().mockResolvedValue({
				data: [],
				pageInfo: { nextCursor: null, hasMore: false },
			});

			await controller.getTopCallers(startTime, endTime, 25, 'test-cursor');

			expect(metricsService.getTopCallers).toHaveBeenCalledWith(
				startTime,
				endTime,
				25,
				'test-cursor',
			);
		});

		it('should use default time window when not provided', async () => {
			metricsService.getTopCallers = jest.fn().mockResolvedValue([]);

			await controller.getTopCallers(undefined, undefined, undefined, undefined);

			expect(metricsService.getTopCallers).toHaveBeenCalled();
		});
	});

	describe('getSummary', () => {
		it('should call service with time window params', async () => {
			const from = new Date('2024-01-01T00:00:00Z');
			const to = new Date('2024-01-01T01:00:00Z');

			metricsService.getSummary = jest.fn().mockResolvedValue({
				totalRequests: 100,
				errorRate: 0.02,
				p95Latency: 200,
				activeActors: 10,
				activeRateLimitViolations: 2,
			});

			const result = await controller.getSummary(from, to);

			expect(metricsService.getSummary).toHaveBeenCalledWith(from, to);
			expect(result.totalRequests).toBe(100);
			expect(result.errorRate).toBe(0.02);
		});

		it('should call service with default time window when not provided', async () => {
			metricsService.getSummary = jest.fn().mockResolvedValue({
				totalRequests: 0,
				errorRate: 0,
				p95Latency: 0,
				activeActors: 0,
				activeRateLimitViolations: 0,
			});

			await controller.getSummary(undefined, undefined);

			expect(metricsService.getSummary).toHaveBeenCalledWith(undefined, undefined);
		});
	});
});

