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
import { HttpMethod, TimeBucket } from '../../src/domain/api-monitoring.types.js';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- minimal entity class token for repository wiring
class HostRouteStatsEntity {}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- minimal entity class token for repository wiring
class HostRequestLogEntity {}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- minimal entity class token for repository wiring
class HostActorEntity {}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- minimal entity class token for repository wiring
class HostMonitoringUserEntity {}

/**
 * Ensures ApiMetricsService builds route-stat rows using the host-supplied
 * ApiRouteStatsEntity class (Strategy 1), not a hard-coded workspace import.
 */
describe('Host-provided ApiRouteStatsEntity (Strategy 1)', () => {
	let service: ApiMetricsService;
	let requestLogRepo: {
		createQueryBuilder: jest.Mock;
		manager: { query: jest.Mock };
		query: jest.Mock;
	};
	let routeStatsRepo: { createQueryBuilder: jest.Mock };
	let actorRepo: Record<string, unknown>;
	let logger: jest.Mocked<IApiMonitoringLogger>;

	beforeEach(async () => {
		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		} as unknown as jest.Mocked<IApiMonitoringLogger>;

		requestLogRepo = {
			createQueryBuilder: jest.fn(),
			manager: { query: jest.fn() },
			query: jest.fn(),
		};

		routeStatsRepo = {
			createQueryBuilder: jest.fn(),
		};

		actorRepo = {};

		const mockQueryBuilder = {
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		};

		routeStatsRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

		const moduleRef = await Test.createTestingModule({
			providers: [
				ApiMetricsService,
				{ provide: API_MONITORING_REQUEST_LOG_REPO, useValue: requestLogRepo },
				{ provide: API_MONITORING_ROUTE_STATS_REPO, useValue: routeStatsRepo },
				{ provide: API_MONITORING_ACTOR_REPO, useValue: actorRepo },
				{ provide: API_MONITORING_LOGGER_TOKEN, useValue: logger },
				{
					provide: API_MONITORING_ENTITY_CLASSES,
					useValue: {
						ApiRequestLogEntity: HostRequestLogEntity,
						ApiRouteStatsEntity: HostRouteStatsEntity,
						ApiActorEntity: HostActorEntity,
						ApiMonitoringUserEntity: HostMonitoringUserEntity,
					},
				},
			],
		}).compile();

		service = moduleRef.get(ApiMetricsService);
	});

	it('instantiates host ApiRouteStatsEntity when time-series falls back to raw SQL', async () => {
		const startTime = new Date('2024-01-01T00:00:00Z');
		const endTime = new Date('2024-01-01T00:30:00Z');

		const sqlRow = {
			bucket_start: startTime.toISOString(),
			route: '/v1/test',
			method: 'GET',
			request_count: '2',
			error_count: '1',
			latency_p50: 10,
			latency_p95: 20,
			latency_p99: 30,
			latency_min: 5,
			latency_max: 40,
			status_code_counts: { '200': 2 },
		};

		requestLogRepo.manager.query = jest.fn().mockResolvedValue([sqlRow]);

		const result = await service.getTimeSeriesMetrics({ startTime, endTime });

		expect(requestLogRepo.manager.query).toHaveBeenCalled();
		expect(result.length).toBe(1);
		expect(result[0]).toBeInstanceOf(HostRouteStatsEntity);
		expect(result[0].route).toBe('/v1/test');
		expect(result[0].method).toBe(HttpMethod.GET);
		expect(result[0].timeBucket).toBe(TimeBucket.MINUTE);
	});
});
