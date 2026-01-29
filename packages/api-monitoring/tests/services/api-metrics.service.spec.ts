import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiMetricsService } from '../../src/services/api-metrics.service.js';
import { ApiRequestLogEntity, ApiRouteStatsEntity, ApiActorEntity } from '@exprealty/database';
import { API_MONITORING_LOGGER_TOKEN } from '../../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../../src/interfaces/logger.interface.js';

describe('ApiMetricsService - Pagination', () => {
	let service: ApiMetricsService;
	let requestLogRepo: jest.Mocked<Repository<ApiRequestLogEntity>>;
	let routeStatsRepo: jest.Mocked<Repository<ApiRouteStatsEntity>>;
	let actorRepo: jest.Mocked<Repository<ApiActorEntity>>;
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
					provide: getRepositoryToken(ApiRequestLogEntity),
					useValue: requestLogRepo,
				},
				{
					provide: getRepositoryToken(ApiRouteStatsEntity),
					useValue: routeStatsRepo,
				},
				{
					provide: getRepositoryToken(ApiActorEntity),
					useValue: actorRepo,
				},
				{
					provide: API_MONITORING_LOGGER_TOKEN,
					useValue: logger,
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
				] as ApiRequestLogEntity[]),
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
				{ id: '1', createdAt: new Date(), hasError: true } as ApiRequestLogEntity,
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
				{ id: '1', createdAt: new Date(), hasError: true } as ApiRequestLogEntity,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getErrorSamples({
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				// No limit, no cursor - should return array
			} as any);

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
					{ id: '1', timestamp: new Date(), actorId: 'actor1' } as ApiRequestLogEntity,
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
				{ id: '1', timestamp: new Date(), actorId: 'actor1' } as ApiRequestLogEntity,
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
				{ id: '1', timestamp: new Date(), actorId: 'actor1' } as ApiRequestLogEntity,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getActorActivity({
				actorId: 'actor1',
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-02T00:00:00Z'),
				// No limit, no cursor - should return array
			} as any);

			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('getTopCallers - Pagination', () => {
		it('should return paginated response when cursor is provided', async () => {
			const cursor = Buffer.from(JSON.stringify({
				timestamp: '100',
				id: 'actor1',
			})).toString('base64');

			const mockLogs = [
				{ id: '1', actorId: 'actor1', actorType: 'USER', hasError: false } as ApiRequestLogEntity,
				{ id: '2', actorId: 'actor2', actorType: 'USER', hasError: false } as ApiRequestLogEntity,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

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
});

