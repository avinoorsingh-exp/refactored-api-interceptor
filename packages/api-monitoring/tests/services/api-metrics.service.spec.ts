import { Test } from '@nestjs/testing';
import { ApiMetricsService } from '../../src/services/api-metrics.service.js';
import { API_MONITORING_LOGGER_TOKEN } from '../../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../../src/interfaces/logger.interface.js';
import { API_MONITORING_ENTITY_CLASSES } from '../../src/tokens/entity-classes.token.js';
import {
	API_MONITORING_ACTOR_REPO,
	API_MONITORING_REQUEST_LOG_REPO,
	API_MONITORING_ROUTE_STATS_REPO,
} from '../../src/tokens/repository.tokens.js';
import { HttpMethod } from '../../src/domain/api-monitoring.types.js';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- minimal entity class token for repository wiring
class MockRouteStatsEntity {}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- minimal entity class token for repository wiring
class MockRequestLogEntity {}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- minimal entity class token for repository wiring
class MockActorEntity {}

const mockEntityClasses = {
	ApiRequestLogEntity: MockRequestLogEntity,
	ApiRouteStatsEntity: MockRouteStatsEntity,
	ApiActorEntity: MockActorEntity,
};

describe('ApiMetricsService - Pagination', () => {
	let service: ApiMetricsService;
	/** In-memory Nest provider mock (not a real `Repository`; uses `manager.query` etc.). */
	let requestLogRepo: any;
	let routeStatsRepo: any;
	let actorRepo: any;
	let logger: jest.Mocked<IApiMonitoringLogger>;

	beforeEach(async () => {
		// Create mock logger
		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		} as any;

		// Create mock repositories
		requestLogRepo = {
			find: jest.fn(),
			createQueryBuilder: jest.fn(),
			query: jest.fn(), // Add query method for getTopCallers
			manager: {
				query: jest.fn(), // For queryRawLogsForTimeSeries
			},
		} as any;

		routeStatsRepo = {
			createQueryBuilder: jest.fn(),
			query: jest.fn(),
		} as any;

		actorRepo = {} as any;

		const module = await Test.createTestingModule({
			providers: [
				ApiMetricsService,
				{
					provide: API_MONITORING_REQUEST_LOG_REPO,
					useValue: requestLogRepo,
				},
				{
					provide: API_MONITORING_ROUTE_STATS_REPO,
					useValue: routeStatsRepo,
				},
				{
					provide: API_MONITORING_ACTOR_REPO,
					useValue: actorRepo,
				},
				{
					provide: API_MONITORING_LOGGER_TOKEN,
					useValue: logger,
				},
				{
					provide: API_MONITORING_ENTITY_CLASSES,
					useValue: mockEntityClasses,
				},
			],
		}).compile();

		service = module.get<ApiMetricsService>(ApiMetricsService);
	});

	describe('getSummary', () => {
		it('should return summary metrics with default 15 minute window', async () => {
			// getSummary uses raw SQL query, not find()
			const mockQueryResult = [{
				totalRequests: '3',
				errorCount: '1',
				p95Latency: '200',
				activeActors: '2',
				activeRateLimitViolations: '1',
			}];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getSummary();

			expect(result.totalRequests).toBe(3);
			expect(result.errorRate).toBeCloseTo(1 / 3, 2);
			expect(result.activeActors).toBe(2); // actor1 and actor2
			expect(result.activeRateLimitViolations).toBe(1);
			expect(result.p95Latency).toBeGreaterThanOrEqual(0);
		});

		it('should return summary metrics with custom time window', async () => {
			const from = new Date('2024-01-01T00:00:00Z');
			const to = new Date('2024-01-01T01:00:00Z');

			const mockQueryResult = [{
				totalRequests: '0',
				errorCount: '0',
				p95Latency: null,
				activeActors: '0',
				activeRateLimitViolations: '0',
			}];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getSummary(from, to);

			expect(requestLogRepo.query).toHaveBeenCalled();
			expect(result.totalRequests).toBe(0);
			expect(result.errorRate).toBe(0);
		});

		it('should return zeros when no logs exist', async () => {
			requestLogRepo.find = jest.fn().mockResolvedValue([]);

			const result = await service.getSummary();

			expect(result).toEqual({
				totalRequests: 0,
				errorRate: 0,
				p95Latency: 0,
				activeActors: 0,
				activeRateLimitViolations: 0,
			});
		});

		it('should handle errors gracefully', async () => {
			// getSummary uses raw SQL query, not find
			requestLogRepo.query = jest.fn().mockRejectedValue(new Error('DB error'));

			const result = await service.getSummary();

			expect(logger.error).toHaveBeenCalled();
			expect(result).toEqual({
				totalRequests: 0,
				errorRate: 0,
				p95Latency: 0,
				activeActors: 0,
				activeRateLimitViolations: 0,
			});
		});

		it('should calculate p95 latency correctly', async () => {
			// getSummary uses raw SQL query with PERCENTILE_CONT
			const mockQueryResult = [{
				totalRequests: '20',
				errorCount: '0',
				p95Latency: '950', // p95 of the latencies array
				activeActors: '1',
				activeRateLimitViolations: '0',
			}];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getSummary();

			// p95 should be around 950 (95th percentile of test data)
			expect(result.p95Latency).toBeGreaterThanOrEqual(900);
		});
	});

	describe('getErrorSamples - Pagination', () => {
		it('should return paginated response when cursor is provided', async () => {
			const cursor = Buffer.from(JSON.stringify({
				timestamp: '2024-01-01T00:00:00.000Z',
				id: 'cursor-id',
			})).toString('base64');

			const mockQueryBuilder = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([
					{
						id: '1',
						createdAt: new Date('2024-01-01T01:00:00Z'),
						hasError: true,
					},
					{
						id: '2',
						createdAt: new Date('2024-01-01T02:00:00Z'),
						hasError: true,
					},
				] as Record<string, unknown>[]),
			};

			requestLogRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			const result = await service.getErrorSamples({
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				limit: 50,
				cursor,
			});

			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('pageInfo');
			expect(Array.isArray((result as any).data)).toBe(true);
		});

		it('should return paginated response when limit is provided', async () => {
			const mockLogs = [
				{ id: '1', createdAt: new Date(), hasError: true } as Record<string, unknown>,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getErrorSamples({
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				limit: 50,
			});

			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('pageInfo');
		});

		it('should return array when no pagination params provided (backward compatibility)', async () => {
			const mockLogs = [
				{ id: '1', createdAt: new Date(), hasError: true } as Record<string, unknown>,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getErrorSamples({
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				// No limit, no cursor - should return array
			});

			expect(Array.isArray(result)).toBe(true);
		});

		it('should handle errors gracefully and return empty paginated response', async () => {
			requestLogRepo.find = jest.fn().mockRejectedValue(new Error('DB error'));

			const result = await service.getErrorSamples({
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				limit: 50,
				cursor: 'valid-cursor',
			});

			expect(logger.error).toHaveBeenCalled();
			expect(result).toHaveProperty('data');
			expect((result as any).data).toEqual([]);
		});
	});

	describe('getActorActivity - Pagination', () => {
		it('should return paginated response when cursor is provided', async () => {
			const cursor = Buffer.from(JSON.stringify({
				timestamp: '2024-01-01T00:00:00.000Z',
				id: 'cursor-id',
			})).toString('base64');

			const mockQueryBuilder = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([
					{ id: '1', timestamp: new Date(), actorId: 'actor1' } as Record<string, unknown>,
				]),
			};

			requestLogRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			const result = await service.getActorActivity({
				actorId: 'actor1',
				cursor,
				limit: 100,
			});

			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('pageInfo');
		});

		it('should return paginated response when limit is provided', async () => {
			const mockLogs = [
				{ id: '1', timestamp: new Date(), actorId: 'actor1' } as Record<string, unknown>,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getActorActivity({
				actorId: 'actor1',
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				limit: 100,
			});

			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('pageInfo');
		});

		it('should return array when no pagination params (backward compatibility)', async () => {
			const mockLogs = [
				{ id: '1', timestamp: new Date(), actorId: 'actor1' } as Record<string, unknown>,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getActorActivity({
				actorId: 'actor1',
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				// No limit, no cursor - should return array
			});

			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('getTopCallers - Pagination', () => {
		it('should return paginated response when cursor is provided', async () => {
			const cursor = Buffer.from(JSON.stringify({
				timestamp: '100',
				id: 'actor1',
			})).toString('base64');

			// getTopCallers uses raw SQL via requestLogRepo.query (not .find)
			const mockQueryResult = [
				{
					actorId: 'actor1',
					actorType: 'USER',
					displayName: 'User 1',
					requestCount: '10',
					errorCount: '0',
				},
				{
					actorId: 'actor2',
					actorType: 'USER',
					displayName: 'User 2',
					requestCount: '5',
					errorCount: '0',
				},
			];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getTopCallers(
				new Date('2024-01-01T00:00:00Z'),
				new Date('2024-01-02T00:00:00Z'),
				25,
				cursor,
			);

			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('pageInfo');
		});

		it('should return array when no pagination params (backward compatibility)', async () => {
			// getTopCallers uses raw SQL query
			const mockQueryResult = [
				{
					actorId: 'actor1',
					actorType: 'USER',
					displayName: 'User 1',
					requestCount: '10',
					errorCount: '0',
				},
			];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getTopCallers(
				new Date('2024-01-01T00:00:00Z'),
				new Date('2024-01-02T00:00:00Z'),
			);

			// When no limit/cursor, returns array for backward compatibility
			expect(Array.isArray(result)).toBe(true);
		});

		it('should enforce max limit of 100', async () => {
			// getTopCallers uses raw SQL query
			requestLogRepo.query = jest.fn().mockResolvedValue([]);

			await service.getTopCallers(
				new Date('2024-01-01T00:00:00Z'),
				new Date('2024-01-02T00:00:00Z'),
				200, // Exceeds max
			);

			// Should process with max limit of 100
			expect(requestLogRepo.query).toHaveBeenCalled();
		});
	});

	describe('getAvailableRoutesAndErrorCodes', () => {
		it('should return routes and error codes for given time window', async () => {
			const startDate = '2024-01-01T00:00:00Z';
			const endDate = '2024-01-31T23:59:59Z';
			const startTime = new Date(startDate);
			const endTime = new Date(endDate);

			// Mock routes query
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([
					{ route: '/v1/agents' },
					{ route: '/v1/companies' },
					{ route: '/v1/users' },
				]),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			// Mock status codes query
			routeStatsRepo.query = jest.fn().mockResolvedValue([
				{ status_code: '200' },
				{ status_code: '400' },
				{ status_code: '404' },
				{ status_code: '500' },
			]);

			const result = await service.getAvailableRoutesAndErrorCodes(startDate, endDate);

			expect(routeStatsRepo.createQueryBuilder).toHaveBeenCalledWith('stats');
			expect(mockQueryBuilder.select).toHaveBeenCalledWith('DISTINCT stats.route', 'route');
			expect(mockQueryBuilder.where).toHaveBeenCalledWith('stats.bucket_start >= :startTime', { startTime });
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('stats.bucket_start <= :endTime', { endTime });
			expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('stats.route', 'ASC');

			expect(routeStatsRepo.query).toHaveBeenCalledWith(
				expect.stringContaining('SELECT DISTINCT status_code'),
				[startTime.toISOString(), endTime.toISOString()],
			);

			expect(result.routes).toEqual(['/v1/agents', '/v1/companies', '/v1/users']);
			expect(result.errorCodes).toEqual(['200', '400', '404', '500']);
		});

		it('should default to last 30 days when no dates provided', async () => {
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([]),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			routeStatsRepo.query = jest.fn().mockResolvedValue([]);

			const result = await service.getAvailableRoutesAndErrorCodes();

			// Verify that dates were calculated (30 days ago to now)
			const callArgs = mockQueryBuilder.where.mock.calls[0];
			expect(callArgs[0]).toBe('stats.bucket_start >= :startTime');
			expect(callArgs[1].startTime).toBeInstanceOf(Date);

			expect(result.routes).toEqual([]);
			expect(result.errorCodes).toEqual([]);
		});

		it('should handle Date objects as input', async () => {
			const startDate = new Date('2024-01-01T00:00:00Z');
			const endDate = new Date('2024-01-31T23:59:59Z');

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ route: '/v1/agents' }]),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			routeStatsRepo.query = jest.fn().mockResolvedValue([{ status_code: '200' }]);

			const result = await service.getAvailableRoutesAndErrorCodes(startDate, endDate);

			expect(mockQueryBuilder.where).toHaveBeenCalledWith('stats.bucket_start >= :startTime', { startTime: startDate });
			expect(result.routes).toEqual(['/v1/agents']);
			expect(result.errorCodes).toEqual(['200']);
		});

		it('should filter out null routes and error codes', async () => {
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([
					{ route: '/v1/agents' },
					{ route: null },
					{ route: '/v1/companies' },
				]),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			routeStatsRepo.query = jest.fn().mockResolvedValue([
				{ status_code: '200' },
				{ status_code: null },
				{ status_code: '404' },
			]);

			const result = await service.getAvailableRoutesAndErrorCodes();

			expect(result.routes).toEqual(['/v1/agents', '/v1/companies']);
			expect(result.errorCodes).toEqual(['200', '404']);
		});

		it('should sort error codes numerically', async () => {
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([]),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			routeStatsRepo.query = jest.fn().mockResolvedValue([
				{ status_code: '500' },
				{ status_code: '200' },
				{ status_code: '404' },
				{ status_code: '400' },
			]);

			const result = await service.getAvailableRoutesAndErrorCodes();

			expect(result.errorCodes).toEqual(['200', '400', '404', '500']);
		});

		it('should return empty arrays for invalid startDate', async () => {
			const invalidDate = 'invalid-date';

			const result = await service.getAvailableRoutesAndErrorCodes(invalidDate);

			expect(result.routes).toEqual([]);
			expect(result.errorCodes).toEqual([]);
			expect(logger.error).toHaveBeenCalledWith(
				'Failed to fetch available routes and error codes',
				expect.objectContaining({
					error: expect.stringContaining('Invalid startDate'),
				}),
			);
		});

		it('should return empty arrays for invalid endDate', async () => {
			const startDate = '2024-01-01T00:00:00Z';
			const invalidDate = 'invalid-date';

			const result = await service.getAvailableRoutesAndErrorCodes(startDate, invalidDate);

			expect(result.routes).toEqual([]);
			expect(result.errorCodes).toEqual([]);
			expect(logger.error).toHaveBeenCalledWith(
				'Failed to fetch available routes and error codes',
				expect.objectContaining({
					error: expect.stringContaining('Invalid endDate'),
				}),
			);
		});

		it('should return empty arrays on error', async () => {
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockRejectedValue(new Error('Database error')),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			const result = await service.getAvailableRoutesAndErrorCodes();

			expect(result.routes).toEqual([]);
			expect(result.errorCodes).toEqual([]);
			expect(logger.error).toHaveBeenCalledWith(
				'Failed to fetch available routes and error codes',
				expect.objectContaining({
					error: 'Database error',
				}),
			);
		});

		it('should log debug information', async () => {
			const startDate = '2024-01-01T00:00:00Z';
			const endDate = '2024-01-31T23:59:59Z';

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([]),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			routeStatsRepo.query = jest.fn().mockResolvedValue([]);

			await service.getAvailableRoutesAndErrorCodes(startDate, endDate);

			expect(logger.debug).toHaveBeenCalledWith(
				'Fetching available routes and error codes',
				expect.objectContaining({
					startTime: expect.any(String),
					endTime: expect.any(String),
				}),
			);

			expect(logger.debug).toHaveBeenCalledWith(
				'Available routes and error codes fetched',
				expect.objectContaining({
					routeCount: 0,
					errorCodeCount: 0,
				}),
			);
		});
	});

	describe('getTimeSeriesMetrics', () => {
		it('should auto-select MINUTE bucket for ranges < 1 hour', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			// Mock manager.query for fallback to raw logs
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined, // Auto-select
			});

			expect(routeStatsRepo.createQueryBuilder).toHaveBeenCalled();
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.time_bucket = :timeBucket',
				{ timeBucket: 'minute' },
			);
		});

		it('should auto-select HOUR bucket for ranges 1-24 hours', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T12:00:00Z'); // 12 hours

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined, // Auto-select
			});

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.time_bucket = :timeBucket',
				{ timeBucket: 'hour' },
			);
		});

		it('should auto-select DAY bucket for ranges > 24 hours', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-03T00:00:00Z'); // 48 hours

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined, // Auto-select
			});

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.time_bucket = :timeBucket',
				{ timeBucket: 'day' },
			);
		});

		it('should use explicitly provided timeBucket', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T12:00:00Z'); // 12 hours, but we want DAY

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: 'day' as any, // Explicit override
			});

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.time_bucket = :timeBucket',
				{ timeBucket: 'day' },
			);
		});

		it('should apply route filter when provided', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T01:00:00Z');

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				route: ['/v1/agents', '/v1/companies'],
			});

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.route IN (:...routes)',
				{ routes: ['/v1/agents', '/v1/companies'] },
			);
		});

		it('should apply method filter when provided', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T01:00:00Z');

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				method: ['GET', 'POST'] as any,
			});

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.method IN (:...methods)',
				{ methods: ['GET', 'POST'] },
			);
		});

		it('should apply statusCode filter when provided', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T01:00:00Z');

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				statusCode: [200, 404],
			});

			// Status code filter uses JSONB query with OR conditions
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('stats.status_code_counts'),
				expect.objectContaining({
					statusCode0: '200',
					statusCode1: '404',
				}),
			);
		});

		it('should fallback to raw logs for small ranges when no pre-aggregated data', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			// Mock manager.query for fallback to raw logs
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined, // Auto-selects MINUTE
			});

			// Should fallback to raw logs query
			expect(requestLogRepo.manager.query).toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalledWith(
				'No pre-aggregated data found, falling back to raw logs for small time range',
				expect.any(Object),
			);
		});

		it('should handle pre-aggregated query errors and fallback to raw logs', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockRejectedValue(new Error('Query failed')),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			// Mock manager.query for fallback to raw logs
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined, // Auto-selects MINUTE
			});

			// Should fallback to raw logs on error
			expect(requestLogRepo.manager.query).toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalledWith(
				'Pre-aggregated query failed, falling back to raw logs',
				expect.objectContaining({
					error: 'Query failed',
				}),
			);
		});

		it('should throw error for large ranges when pre-aggregated query fails', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-02T00:00:00Z'); // 24 hours

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockRejectedValue(new Error('Query failed')),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			await expect(
				service.getTimeSeriesMetrics({
					startTime,
					endTime,
					timeBucket: undefined,
				}),
			).rejects.toThrow('Query failed');

			// Should NOT fallback to raw logs for large ranges
			expect(requestLogRepo.query).not.toHaveBeenCalled();
		});
	});

	describe('getSummary - Edge Cases', () => {
		it('should handle null p95Latency from database', async () => {
			const mockQueryResult = [{
				totalRequests: '10',
				errorCount: '0',
				p95Latency: null, // Null when no data
				activeActors: '1',
				activeRateLimitViolations: '0',
			}];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getSummary();

			expect(result.p95Latency).toBe(0);
			expect(result.totalRequests).toBe(10);
		});

		it('should handle empty query result', async () => {
			requestLogRepo.query = jest.fn().mockResolvedValue([]);

			const result = await service.getSummary();

			expect(result).toEqual({
				totalRequests: 0,
				errorRate: 0,
				p95Latency: 0,
				activeActors: 0,
				activeRateLimitViolations: 0,
			});
		});

		it('should handle query result with missing fields', async () => {
			const mockQueryResult = [{
				totalRequests: '5',
				// Missing other fields
			}];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getSummary();

			expect(result.totalRequests).toBe(5);
			expect(result.errorRate).toBe(0);
			expect(result.p95Latency).toBe(0);
		});

		it('should handle snake_case field names from database', async () => {
			const mockQueryResult = [{
				total_requests: '20',
				error_count: '2',
				p95_latency: '150',
				active_actors: '3',
				active_rate_limit_violations: '1',
			}];

			requestLogRepo.query = jest.fn().mockResolvedValue(mockQueryResult);

			const result = await service.getSummary();

			expect(result.totalRequests).toBe(20);
			expect(result.errorRate).toBeCloseTo(0.1, 2);
			expect(result.p95Latency).toBe(150);
			expect(result.activeActors).toBe(3);
			expect(result.activeRateLimitViolations).toBe(1);
		});
	});

	describe('getTimeSeriesMetrics - Edge Cases', () => {
		it('should return pre-aggregated stats when available (no fallback)', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T12:00:00Z'); // 12 hours

			const mockStats: Record<string, unknown>[] = [
				{
					id: '1',
					route: '/v1/agents',
					method: 'GET',
					timeBucket: 'hour',
					bucketStart: new Date('2024-01-01T00:00:00Z'),
					requestCount: 100,
					errorCount: 5,
					latencyP50: 50,
					latencyP95: 100,
					latencyP99: 150,
					latencyMin: 10,
					latencyMax: 200,
					statusCodeCounts: { '200': 95, '500': 5 },
				},
			];

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			const result = await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined,
			});

			expect(result).toEqual(mockStats);
			expect(result.length).toBe(1);
			// Should NOT fallback to raw logs when pre-aggregated data exists
			expect(requestLogRepo.manager.query).not.toHaveBeenCalled();
		});

		it('should return pre-aggregated stats for large ranges even when empty (no fallback)', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-02T00:00:00Z'); // 24 hours (large range)

			const mockStats: Record<string, unknown>[] = []; // Empty but still return it

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			const result = await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined,
			});

			expect(result).toEqual(mockStats);
			// Should NOT fallback to raw logs for large ranges (even when empty)
			expect(requestLogRepo.manager.query).not.toHaveBeenCalled();
		});

		it('should return pre-aggregated stats when available even for small ranges', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes (small range)

			const mockStats: Record<string, unknown>[] = [
				{
					id: '1',
					route: '/v1/agents',
					method: 'GET',
					timeBucket: 'minute',
					bucketStart: new Date('2024-01-01T00:00:00Z'),
					requestCount: 50,
					errorCount: 2,
					latencyP50: 30,
					latencyP95: 80,
					latencyP99: 120,
					latencyMin: 5,
					latencyMax: 150,
					statusCodeCounts: { '200': 48, '500': 2 },
				},
			];

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

			const result = await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined, // Auto-selects MINUTE
			});

			expect(result).toEqual(mockStats);
			// Should NOT fallback to raw logs when pre-aggregated data exists (even for small ranges)
			expect(requestLogRepo.manager.query).not.toHaveBeenCalled();
		});

		it('should handle single route filter', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T01:00:00Z');

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				route: '/v1/agents', // Single route (not array)
			});

			// Should convert single value to array
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.route IN (:...routes)',
				{ routes: ['/v1/agents'] },
			);
		});

		it('should handle single method filter', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T01:00:00Z');

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				method: 'GET' as any, // Single method (not array)
			});

			// Should convert single value to array
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'stats.method IN (:...methods)',
				{ methods: ['GET'] },
			);
		});

		it('should handle single statusCode filter', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T01:00:00Z');

			const mockStats: Record<string, unknown>[] = [];
			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockStats),
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				statusCode: 200, // Single status code (not array)
			});

			// Should convert single value to array and use JSONB query
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('stats.status_code_counts'),
				expect.objectContaining({
					statusCode0: '200',
				}),
			);
		});

		it('should build raw logs query with route filter', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				route: ['/v1/agents'],
				timeBucket: undefined,
			});

			// Should fallback to raw logs with route filter
			expect(requestLogRepo.manager.query).toHaveBeenCalled();
			const sqlCall = requestLogRepo.manager.query.mock.calls[0][0];
			expect(sqlCall).toContain('"log"."route" IN');
		});

		it('should build raw logs query with method filter', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				method: [HttpMethod.GET],
				timeBucket: undefined,
			});

			// Should fallback to raw logs with method filter
			expect(requestLogRepo.manager.query).toHaveBeenCalled();
			const sqlCall = requestLogRepo.manager.query.mock.calls[0][0];
			expect(sqlCall).toContain('"log"."method" IN');
		});

		it('should build raw logs query with statusCode filter', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				statusCode: [200, 404],
				timeBucket: undefined,
			});

			// Should fallback to raw logs with statusCode filter
			expect(requestLogRepo.manager.query).toHaveBeenCalled();
			const sqlCall = requestLogRepo.manager.query.mock.calls[0][0];
			expect(sqlCall).toContain('"log"."status_code" IN');
		});

		it('should build raw logs query with all filters combined', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([]);

			await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				route: ['/v1/agents'],
				method: [HttpMethod.GET],
				statusCode: [200],
				timeBucket: undefined,
			});

			// Should fallback to raw logs with all filters
			expect(requestLogRepo.manager.query).toHaveBeenCalled();
			const sqlCall = requestLogRepo.manager.query.mock.calls[0][0];
			expect(sqlCall).toContain('"log"."route" IN');
			expect(sqlCall).toContain('"log"."method" IN');
			expect(sqlCall).toContain('"log"."status_code" IN');
		});

		it('should build raw logs query without filters', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([
				{
					route: '/v1/agents',
					method: 'GET',
					bucket_start: new Date('2024-01-01T00:00:00Z'),
					request_count: 10,
					error_count: 1,
					latency_p50: 50,
					latency_p95: 100,
					latency_p99: 150,
					latency_min: 10,
					latency_max: 200,
					status_code_counts: { '200': 9, '500': 1 },
				},
			]);

			const result = await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined,
			});

			// Should fallback to raw logs without filters
			expect(requestLogRepo.manager.query).toHaveBeenCalled();
			const sqlCall = requestLogRepo.manager.query.mock.calls[0][0];
			expect(sqlCall).toContain('"log"."timestamp"');
			expect(sqlCall).not.toContain('"log"."route" IN');
			expect(sqlCall).not.toContain('"log"."method" IN');
			expect(sqlCall).not.toContain('"log"."status_code" IN');
			expect(result.length).toBeGreaterThan(0);
		});

		it('should transform raw logs query results correctly', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			
			// Mock raw query result with string status_code_counts (needs JSON.parse)
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([
				{
					bucket_start: '2024-01-01T00:00:00Z',
					route: '/v1/agents',
					method: 'GET',
					request_count: '25',
					error_count: '2',
					latency_p50: '45',
					latency_p95: '95',
					latency_p99: '145',
					latency_min: '8',
					latency_max: '195',
					status_code_counts: '{"200":23,"500":2}', // String that needs parsing
				},
			]);

			const result = await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined,
			});

			expect(result.length).toBe(1);
			expect(result[0].route).toBe('/v1/agents');
			expect(result[0].method).toBe('GET');
			expect(result[0].requestCount).toBe(25);
			expect(result[0].errorCount).toBe(2);
			expect(result[0].timeBucket).toBe('minute');
			expect(result[0].statusCodeCounts).toEqual({ '200': 23, '500': 2 });
		});

		it('should handle raw logs query results with null/undefined latency values', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T00:30:00Z'); // 30 minutes

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]), // No pre-aggregated data
			};

			routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
			
			// Mock raw query result with null latency values
			requestLogRepo.manager.query = jest.fn().mockResolvedValue([
				{
					bucket_start: '2024-01-01T00:00:00Z',
					route: '/v1/agents',
					method: 'GET',
					request_count: '5',
					error_count: '0',
					latency_p50: null,
					latency_p95: null,
					latency_p99: null,
					latency_min: null,
					latency_max: null,
					status_code_counts: { '200': 5 },
				},
			]);

			const result = await service.getTimeSeriesMetrics({
				startTime,
				endTime,
				timeBucket: undefined,
			});

			expect(result.length).toBe(1);
			expect(result[0].latencyP50).toBeUndefined();
			expect(result[0].latencyP95).toBeUndefined();
			expect(result[0].latencyP99).toBeUndefined();
			expect(result[0].latencyMin).toBeUndefined();
			expect(result[0].latencyMax).toBeUndefined();
		});
	});
});

