import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ApiMonitoringController } from '../src/api-monitoring.controller.js';
import { ApiMetricsService } from '../src/services/api-metrics.service.js';
import { API_MONITORING_LOGGER_TOKEN } from '../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../src/interfaces/logger.interface.js';
import { ErrorSampleQueryDto } from '../src/dto/error-sample-query.dto.js';
import { ActorActivityQueryDto } from '../src/dto/actor-activity-query.dto.js';
import { TimeSeriesQueryDto } from '../src/dto/time-series-query.dto.js';
import { TopCallersQueryDto } from '../src/dto/top-callers-query.dto.js';
import { TimeBucket } from '@exprealty/shared-domain';

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
			getTimeSeriesMetrics: jest.fn(),
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
			const query = new TopCallersQueryDto();
			query.startTime = '2024-01-01T00:00:00Z';
			query.endTime = '2024-01-02T00:00:00Z';
			query.limit = 25;
			query.cursor = 'test-cursor';

			metricsService.getTopCallers = jest.fn().mockResolvedValue({
				data: [],
				pageInfo: { nextCursor: null, hasMore: false },
			});

			await controller.getTopCallers(query);

			expect(metricsService.getTopCallers).toHaveBeenCalledWith(
				expect.any(Date), // startTime converted to Date
				expect.any(Date), // endTime converted to Date
				25,
				'test-cursor',
				undefined, // actorId
				undefined, // route
				undefined, // statusCode
				false, // debug
			);
		});

		it('should convert string dates to Date objects', async () => {
			const query = new TopCallersQueryDto();
			query.startTime = '2024-01-01T00:00:00Z';
			query.endTime = '2024-01-02T00:00:00Z';
			query.limit = 50;

			metricsService.getTopCallers = jest.fn().mockResolvedValue({
				data: [],
				pageInfo: { nextCursor: null, hasMore: false },
			});

			await controller.getTopCallers(query);

			const callArgs = metricsService.getTopCallers.mock.calls[0];
			expect(callArgs[0]).toBeInstanceOf(Date);
			expect(callArgs[1]).toBeInstanceOf(Date);
			expect(callArgs[0].getTime()).toBe(new Date('2024-01-01T00:00:00Z').getTime());
			expect(callArgs[1].getTime()).toBe(new Date('2024-01-02T00:00:00Z').getTime());
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

	describe('getTimeSeriesMetrics', () => {
		it('should convert string dates to Date objects', async () => {
			const query = new TimeSeriesQueryDto();
			query.startTime = '2024-01-01T00:00:00Z' as any; // Simulate string from query params
			query.endTime = '2024-01-02T00:00:00Z' as any; // Simulate string from query params
			query.timeBucket = TimeBucket.HOUR;

			metricsService.getTimeSeriesMetrics = jest.fn().mockResolvedValue([]);

			await controller.getTimeSeriesMetrics(query);

			expect(metricsService.getTimeSeriesMetrics).toHaveBeenCalledWith(
				expect.objectContaining({
					startTime: expect.any(Date),
					endTime: expect.any(Date),
					timeBucket: TimeBucket.HOUR,
				}),
			);

			// Verify dates are correctly parsed
			const callArgs = metricsService.getTimeSeriesMetrics.mock.calls[0][0];
			expect(callArgs.startTime.getTime()).toBe(new Date('2024-01-01T00:00:00Z').getTime());
			expect(callArgs.endTime.getTime()).toBe(new Date('2024-01-02T00:00:00Z').getTime());
		});

		it('should pass through Date objects if already Date instances', async () => {
			const query = new TimeSeriesQueryDto();
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-02T00:00:00Z');
			query.startTime = startTime;
			query.endTime = endTime;
			query.timeBucket = TimeBucket.DAY;

			metricsService.getTimeSeriesMetrics = jest.fn().mockResolvedValue([]);

			await controller.getTimeSeriesMetrics(query);

			expect(metricsService.getTimeSeriesMetrics).toHaveBeenCalledWith(
				expect.objectContaining({
					startTime: startTime,
					endTime: endTime,
					timeBucket: TimeBucket.DAY,
				}),
			);
		});

		it('should throw error for invalid startTime', async () => {
			const query = new TimeSeriesQueryDto();
			query.startTime = 'invalid-date' as any;
			query.endTime = '2024-01-02T00:00:00Z' as any;

			await expect(controller.getTimeSeriesMetrics(query)).rejects.toThrow('Invalid startTime: invalid-date');
		});

		it('should throw error for invalid endTime', async () => {
			const query = new TimeSeriesQueryDto();
			query.startTime = '2024-01-01T00:00:00Z' as any;
			query.endTime = 'invalid-date' as any;

			await expect(controller.getTimeSeriesMetrics(query)).rejects.toThrow('Invalid endTime: invalid-date');
		});

		it('should pass all query parameters correctly', async () => {
			const query = new TimeSeriesQueryDto();
			query.startTime = '2024-01-01T00:00:00Z' as any;
			query.endTime = '2024-01-02T00:00:00Z' as any;
			query.timeBucket = TimeBucket.HOUR;
			query.route = ['/v1/agents', '/v1/companies'];
			query.method = ['GET', 'POST'] as any;
			query.statusCode = [200, 404];
			query.actorId = 'actor-123';

			metricsService.getTimeSeriesMetrics = jest.fn().mockResolvedValue([]);

			await controller.getTimeSeriesMetrics(query);

			expect(metricsService.getTimeSeriesMetrics).toHaveBeenCalledWith({
				startTime: expect.any(Date),
				endTime: expect.any(Date),
				timeBucket: TimeBucket.HOUR,
				route: ['/v1/agents', '/v1/companies'],
				method: ['GET', 'POST'],
				statusCode: [200, 404],
				actorId: 'actor-123',
			});
		});

		it('should handle optional timeBucket parameter', async () => {
			const query = new TimeSeriesQueryDto();
			query.startTime = '2024-01-01T00:00:00Z' as any;
			query.endTime = '2024-01-02T00:00:00Z' as any;
			// timeBucket is optional

			metricsService.getTimeSeriesMetrics = jest.fn().mockResolvedValue([]);

			await controller.getTimeSeriesMetrics(query);

			expect(metricsService.getTimeSeriesMetrics).toHaveBeenCalledWith(
				expect.objectContaining({
					startTime: expect.any(Date),
					endTime: expect.any(Date),
					timeBucket: undefined,
				}),
			);
		});

		it('should log debug information with ISO string dates', async () => {
			const query = new TimeSeriesQueryDto();
			query.startTime = '2024-01-01T00:00:00Z' as any;
			query.endTime = '2024-01-02T00:00:00Z' as any;
			query.route = ['/v1/agents'];
			query.method = ['GET'] as any;

			metricsService.getTimeSeriesMetrics = jest.fn().mockResolvedValue([]);

			await controller.getTimeSeriesMetrics(query);

			expect(logger.debug).toHaveBeenCalledWith(
				'Fetching time-series metrics',
				expect.objectContaining({
					startTime: '2024-01-01T00:00:00.000Z',
					endTime: '2024-01-02T00:00:00.000Z',
					route: ['/v1/agents'],
					method: ['GET'],
				}),
			);
		});
	});
});


