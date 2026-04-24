import { Test } from '@nestjs/testing';
import { ApiMonitoringController } from '../src/api-monitoring.controller.js';
import { ApiMetricsService } from '../src/services/api-metrics.service.js';
import { API_MONITORING_LOGGER_TOKEN } from '../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../src/interfaces/logger.interface.js';
import { ErrorSampleQueryDto } from '../src/dto/error-sample-query.dto.js';
import { ActorActivityQueryDto } from '../src/dto/actor-activity-query.dto.js';
import { TimeSeriesQueryDto } from '../src/dto/time-series-query.dto.js';
import { TopCallersQueryDto } from '../src/dto/top-callers-query.dto.js';
import { RouteBreakdownQueryDto } from '../src/dto/route-breakdown-query.dto.js';
import { TrendsQueryDto, TrendsRange } from '../src/dto/trends-query.dto.js';
import { TimeBucket } from '../src/domain/api-monitoring.types.js';

describe('ApiMonitoringController - Pagination', () => {
	let controller: ApiMonitoringController;
	/** Nest `useValue` mock (loose typing so per-test `mockResolvedValue` works with `tsc`). */
	let metricsService: any;
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
			getAvailableRoutesAndErrorCodes: jest.fn(),
			getRouteBreakdown: jest.fn(),
			getTrendsMetrics: jest.fn(),
			aggregateAllRouteStats: jest.fn(),
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
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- exercising legacy query param
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
			const from = '2024-01-01T00:00:00.000Z';
			const to = '2024-01-01T01:00:00.000Z';

			metricsService.getSummary = jest.fn().mockResolvedValue({
				totalRequests: 100,
				errorRate: 0.02,
				p95Latency: 200,
				activeActors: 10,
				activeRateLimitViolations: 2,
			});

			const result = await controller.getSummary(from, to);

			expect(metricsService.getSummary).toHaveBeenCalledWith(new Date(from), new Date(to));
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

	describe('getAvailableRoutesAndErrorCodes', () => {
		it('should call service with query parameters', async () => {
			const query = {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-01-31T23:59:59Z',
			};

			const expectedResult = {
				routes: ['/v1/agents', '/v1/companies', '/v1/users'],
				errorCodes: ['200', '400', '404', '500'],
			};

			metricsService.getAvailableRoutesAndErrorCodes = jest.fn().mockResolvedValue(expectedResult);

			const result = await controller.getAvailableRoutesAndErrorCodes(query);

			expect(metricsService.getAvailableRoutesAndErrorCodes).toHaveBeenCalledWith(
				'2024-01-01T00:00:00Z',
				'2024-01-31T23:59:59Z',
			);
			expect(result).toEqual(expectedResult);
		});

		it('should call service with undefined when dates are not provided', async () => {
			const query = {};

			const expectedResult = {
				routes: ['/v1/agents'],
				errorCodes: ['200', '404'],
			};

			metricsService.getAvailableRoutesAndErrorCodes = jest.fn().mockResolvedValue(expectedResult);

			const result = await controller.getAvailableRoutesAndErrorCodes(query);

			expect(metricsService.getAvailableRoutesAndErrorCodes).toHaveBeenCalledWith(
				undefined,
				undefined,
			);
			expect(result).toEqual(expectedResult);
		});

		it('should log debug information', async () => {
			const query = {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-01-31T23:59:59Z',
			};

			metricsService.getAvailableRoutesAndErrorCodes = jest.fn().mockResolvedValue({
				routes: [],
				errorCodes: [],
			});

			await controller.getAvailableRoutesAndErrorCodes(query);

			expect(logger.debug).toHaveBeenCalledWith(
				'Fetching available routes and error codes',
				{
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
			);
		});
	});

	describe('getRouteBreakdown', () => {
		it('should call service with query parameters', async () => {
			const query = new RouteBreakdownQueryDto();
			query.startTime = new Date('2024-01-01T00:00:00Z');
			query.endTime = new Date('2024-01-02T00:00:00Z');
			query.limit = 50;
			query.route = ['/v1/agents'];
			query.method = ['GET'] as any;
			query.statusCode = [200];
			query.debug = true;

			metricsService.getRouteBreakdown = jest.fn().mockResolvedValue([]);

			await controller.getRouteBreakdown(query);

			expect(metricsService.getRouteBreakdown).toHaveBeenCalledWith(
				expect.any(Date), // startTime
				expect.any(Date), // endTime
				50, // limit
				['/v1/agents'], // route
				['GET'], // method
				[200], // statusCode
				true, // debug
			);
		});

		it('should use default time window when not provided', async () => {
			const query = new RouteBreakdownQueryDto();
			query.limit = 25;

			metricsService.getRouteBreakdown = jest.fn().mockResolvedValue([]);

			await controller.getRouteBreakdown(query);

			const callArgs = metricsService.getRouteBreakdown.mock.calls[0];
			expect(callArgs[0]).toBeInstanceOf(Date); // startTime (defaults to 15 min ago)
			expect(callArgs[1]).toBeInstanceOf(Date); // endTime (defaults to now)
			expect(callArgs[2]).toBe(25); // limit
		});

		it('should convert string dates to Date objects', async () => {
			const query = new RouteBreakdownQueryDto();
			query.startTime = '2024-01-01T00:00:00Z' as any;
			query.endTime = '2024-01-02T00:00:00Z' as any;

			metricsService.getRouteBreakdown = jest.fn().mockResolvedValue([]);

			await controller.getRouteBreakdown(query);

			const callArgs = metricsService.getRouteBreakdown.mock.calls[0];
			expect(callArgs[0]).toBeInstanceOf(Date);
			expect(callArgs[1]).toBeInstanceOf(Date);
		});

		it('should use default limit of 50 when not provided', async () => {
			const query = new RouteBreakdownQueryDto();

			metricsService.getRouteBreakdown = jest.fn().mockResolvedValue([]);

			await controller.getRouteBreakdown(query);

			expect(metricsService.getRouteBreakdown).toHaveBeenCalledWith(
				expect.any(Date),
				expect.any(Date),
				50, // default limit
				undefined,
				undefined,
				undefined,
				false, // debug defaults to false
			);
		});

		it('should log debug information', async () => {
			const query = new RouteBreakdownQueryDto();
			query.startTime = new Date('2024-01-01T00:00:00Z');
			query.endTime = new Date('2024-01-02T00:00:00Z');
			query.limit = 50;
			query.debug = true;

			metricsService.getRouteBreakdown = jest.fn().mockResolvedValue([]);

			await controller.getRouteBreakdown(query);

			expect(logger.debug).toHaveBeenCalledWith(
				'Fetching route breakdown',
				expect.objectContaining({
					startTime: expect.any(String),
					endTime: expect.any(String),
					limit: 50,
					debug: true,
				}),
			);
		});
	});

	describe('getTrendsMetrics', () => {
		it('should call service with range parameter', async () => {
			const query = new TrendsQueryDto();
			query.range = TrendsRange.DAYS_30;
			query.route = ['/v1/agents'];
			query.method = 'GET' as any;
			query.statusCode = [200, 404];

			const expectedResult = {
				startDate: new Date('2024-01-01T00:00:00Z'),
				endDate: new Date('2024-01-31T23:59:59Z'),
				timeBucket: TimeBucket.DAY,
				data: [],
				kpiSummary: {
					avgRequestsPerDay: 100,
					overallErrorRate: 0.02,
					avgP95Latency: 200,
					avgLatencyVariability: 50,
				},
			};

			metricsService.getTrendsMetrics = jest.fn().mockResolvedValue(expectedResult);

			const result = await controller.getTrendsMetrics(query);

			expect(metricsService.getTrendsMetrics).toHaveBeenCalledWith(
				30, // range
				['/v1/agents'], // route
				'GET', // method
				[200, 404], // statusCode
			);
			expect(result).toEqual(expectedResult);
		});

		it('should parse string range value "30d" to number', async () => {
			const query = { range: '30d' as any } as TrendsQueryDto;
			query.route = undefined;
			query.method = undefined;
			query.statusCode = undefined;

			metricsService.getTrendsMetrics = jest.fn().mockResolvedValue({
				startDate: new Date(),
				endDate: new Date(),
				timeBucket: TimeBucket.DAY,
				data: [],
				kpiSummary: {} as any,
			});

			await controller.getTrendsMetrics(query);

			expect(metricsService.getTrendsMetrics).toHaveBeenCalledWith(
				30, // parsed from "30d"
				undefined,
				undefined,
				undefined,
			);
		});

		it('should parse string range value "60d" to number', async () => {
			const query = { range: '60d' as any } as TrendsQueryDto;

			metricsService.getTrendsMetrics = jest.fn().mockResolvedValue({
				startDate: new Date(),
				endDate: new Date(),
				timeBucket: TimeBucket.DAY,
				data: [],
				kpiSummary: {} as any,
			});

			await controller.getTrendsMetrics(query);

			expect(metricsService.getTrendsMetrics).toHaveBeenCalledWith(
				60, // parsed from "60d"
				undefined,
				undefined,
				undefined,
			);
		});

		it('should throw error for invalid range string', async () => {
			const query = { range: '45d' as any } as TrendsQueryDto;

			await expect(controller.getTrendsMetrics(query)).rejects.toThrow(
				'Invalid range: 45d. Must be 30d, 60d, 90d, 30, 60, or 90',
			);
		});

		it('should throw error for invalid range type', async () => {
			const query = { range: true as any } as TrendsQueryDto;

			await expect(controller.getTrendsMetrics(query)).rejects.toThrow('Invalid range type: boolean');
		});

		it('should log debug information', async () => {
			const query = new TrendsQueryDto();
			query.range = TrendsRange.DAYS_90;
			query.route = ['/v1/agents', '/v1/companies'];
			query.statusCode = [200, 500];

			metricsService.getTrendsMetrics = jest.fn().mockResolvedValue({
				startDate: new Date(),
				endDate: new Date(),
				timeBucket: TimeBucket.DAY,
				data: [],
				kpiSummary: {} as any,
			});

			await controller.getTrendsMetrics(query);

			expect(logger.debug).toHaveBeenCalledWith(
				'Fetching trends metrics',
				expect.objectContaining({
					range: 90,
					routes: ['/v1/agents', '/v1/companies'],
					statusCodes: [200, 500],
				}),
			);
		});
	});

	describe('triggerAggregation', () => {
		it('should call service with time range and bucket', async () => {
			const startTime = '2024-01-01T00:00:00Z';
			const endTime = '2024-01-02T00:00:00Z';
			const timeBucket = TimeBucket.HOUR;

			metricsService.aggregateAllRouteStats = jest.fn().mockResolvedValue(10);

			const result = await controller.triggerAggregation(startTime, endTime, timeBucket);

			expect(metricsService.aggregateAllRouteStats).toHaveBeenCalledWith(
				expect.any(Date), // startTime converted to Date
				expect.any(Date), // endTime converted to Date
				TimeBucket.HOUR,
			);
			expect(result.aggregatedCount).toBe(10);
			expect(result.timeBucket).toBe(TimeBucket.HOUR);
		});

		it('should use default time range when not provided', async () => {
			metricsService.aggregateAllRouteStats = jest.fn().mockResolvedValue(5);

			const result = await controller.triggerAggregation(undefined, undefined, undefined);

			const callArgs = metricsService.aggregateAllRouteStats.mock.calls[0];
			expect(callArgs[0]).toBeInstanceOf(Date); // startTime (defaults to 24h ago)
			expect(callArgs[1]).toBeInstanceOf(Date); // endTime (defaults to now)
			expect(callArgs[2]).toBe(TimeBucket.HOUR); // default bucket
			expect(result.aggregatedCount).toBe(5);
		});

		it('should convert string dates to Date objects', async () => {
			const startTime = '2024-01-01T00:00:00Z';
			const endTime = '2024-01-02T00:00:00Z';

			metricsService.aggregateAllRouteStats = jest.fn().mockResolvedValue(0);

			await controller.triggerAggregation(startTime, endTime, undefined);

			const callArgs = metricsService.aggregateAllRouteStats.mock.calls[0];
			expect(callArgs[0]).toBeInstanceOf(Date);
			expect(callArgs[1]).toBeInstanceOf(Date);
			expect(callArgs[0].getTime()).toBe(new Date(startTime).getTime());
			expect(callArgs[1].getTime()).toBe(new Date(endTime).getTime());
		});

		it('should pass through Date objects if already Date instances', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-02T00:00:00Z');

			metricsService.aggregateAllRouteStats = jest.fn().mockResolvedValue(0);

			await controller.triggerAggregation(startTime, endTime, TimeBucket.DAY);

			expect(metricsService.aggregateAllRouteStats).toHaveBeenCalledWith(
				startTime,
				endTime,
				TimeBucket.DAY,
			);
		});

		it('should throw error for invalid startTime', async () => {
			await expect(controller.triggerAggregation('invalid-date', undefined, undefined)).rejects.toThrow(
				'Invalid startTime: invalid-date',
			);
		});

		it('should throw error for invalid endTime', async () => {
			// When endTime is invalid, startTime defaults to 24h ago (valid), so we need to provide a valid startTime
			const validStartTime = new Date('2024-01-01T00:00:00Z');
			await expect(controller.triggerAggregation(validStartTime, 'invalid-date', undefined)).rejects.toThrow(
				'Invalid endTime: invalid-date',
			);
		});

		it('should default to HOUR bucket for invalid timeBucket', async () => {
			metricsService.aggregateAllRouteStats = jest.fn().mockResolvedValue(0);

			await controller.triggerAggregation(undefined, undefined, 'invalid-bucket');

			expect(metricsService.aggregateAllRouteStats).toHaveBeenCalledWith(
				expect.any(Date),
				expect.any(Date),
				TimeBucket.HOUR, // defaults to HOUR
			);
		});

		it('should log info with aggregation parameters', async () => {
			const startTime = '2024-01-01T00:00:00Z';
			const endTime = '2024-01-02T00:00:00Z';

			metricsService.aggregateAllRouteStats = jest.fn().mockResolvedValue(15);

			await controller.triggerAggregation(startTime, endTime, TimeBucket.DAY);

			expect(logger.info).toHaveBeenCalledWith(
				'Triggering route stats aggregation',
				expect.objectContaining({
					startTime: expect.any(String),
					endTime: expect.any(String),
					timeBucket: TimeBucket.DAY,
				}),
			);
		});

		it('should return aggregation result with ISO string dates', async () => {
			const startTime = '2024-01-01T00:00:00Z';
			const endTime = '2024-01-02T00:00:00Z';

			metricsService.aggregateAllRouteStats = jest.fn().mockResolvedValue(20);

			const result = await controller.triggerAggregation(startTime, endTime, TimeBucket.HOUR);

			expect(result).toEqual({
				aggregatedCount: 20,
				startTime: expect.any(String), // ISO string
				endTime: expect.any(String), // ISO string
				timeBucket: TimeBucket.HOUR,
			});
			expect(result.startTime).toBe(new Date(startTime).toISOString());
			expect(result.endTime).toBe(new Date(endTime).toISOString());
		});
	});
});


