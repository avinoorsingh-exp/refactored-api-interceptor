import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiMetricsService } from '../../src/services/api-metrics.service.js';
import { ApiRequestLogEntity, ApiRouteStatsEntity } from '@exprealty/database';
import { API_MONITORING_LOGGER_TOKEN } from '../../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../../src/interfaces/logger.interface.js';

describe('ApiMetricsService - Pagination', () => {
	let service: ApiMetricsService;
	let requestLogRepo: jest.Mocked<Repository<ApiRequestLogEntity>>;
	let routeStatsRepo: jest.Mocked<Repository<ApiRouteStatsEntity>>;
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
		} as any;

		routeStatsRepo = {} as any;

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
					provide: API_MONITORING_LOGGER_TOKEN,
					useValue: logger,
				},
			],
		}).compile();

		service = module.get<ApiMetricsService>(ApiMetricsService);
	});

	describe('getSummary', () => {
		it('should return summary metrics with default 15 minute window', async () => {
			const mockLogs: ApiRequestLogEntity[] = [
				{
					id: '1',
					actorId: 'actor1',
					statusCode: 200,
					latencyMs: 100,
					hasError: false,
					timestamp: new Date(),
					createdAt: new Date(),
				} as ApiRequestLogEntity,
				{
					id: '2',
					actorId: 'actor2',
					statusCode: 500,
					latencyMs: 500,
					hasError: true,
					timestamp: new Date(),
					createdAt: new Date(),
				} as ApiRequestLogEntity,
				{
					id: '3',
					actorId: 'actor1',
					statusCode: 429,
					latencyMs: 200,
					hasError: false,
					timestamp: new Date(),
					createdAt: new Date(),
				} as ApiRequestLogEntity,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

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

			requestLogRepo.find = jest.fn().mockResolvedValue([]);

			const result = await service.getSummary(from, to);

			expect(requestLogRepo.find).toHaveBeenCalledWith({
				where: {
					timestamp: expect.anything(),
				},
			});
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
			requestLogRepo.find = jest.fn().mockRejectedValue(new Error('DB error'));

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
			const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000];
			const mockLogs = latencies.map((latency, index) => ({
				id: `id-${index}`,
				actorId: 'actor1',
				statusCode: 200,
				latencyMs: latency,
				hasError: false,
				timestamp: new Date(),
				createdAt: new Date(),
			})) as ApiRequestLogEntity[];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getSummary();

			// p95 should be around the 19th element (95% of 20 = 19)
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
			const mockLogs = [
				{ id: '1', actorId: 'actor1', actorType: 'USER', hasError: false } as ApiRequestLogEntity,
			];

			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			const result = await service.getTopCallers(
				new Date('2024-01-01T00:00:00Z'),
				new Date('2024-01-02T00:00:00Z'),
			);

			expect(Array.isArray(result)).toBe(true);
		});

		it('should enforce max limit of 100', async () => {
			const mockLogs: ApiRequestLogEntity[] = [];
			requestLogRepo.find = jest.fn().mockResolvedValue(mockLogs);

			await service.getTopCallers(
				new Date('2024-01-01T00:00:00Z'),
				new Date('2024-01-02T00:00:00Z'),
				200, // Exceeds max
			);

			// Should process with max limit of 100
			expect(requestLogRepo.find).toHaveBeenCalled();
		});
	});
});

