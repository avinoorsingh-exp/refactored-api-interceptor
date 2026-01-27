import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between } from 'typeorm';
import {
	ApiRequestLogEntity,
	ApiRouteStatsEntity,
} from '@exprealty/database';
import {
	HttpMethod,
	TimeBucket,
	type TimeSeriesQuery,
	type ActorActivityQuery,
	type ErrorSampleQuery,
} from '@exprealty/shared-domain';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Service for aggregating and querying API metrics.
 * 
 * Provides:
 * - Time-series metrics by route
 * - Per-actor activity tracking
 * - Error sample queries
 * - Latency percentile calculations
 * 
 * Designed to support Prometheus/OpenTelemetry export in the future.
 * 
 * @public
 */
@Injectable()
export class ApiMetricsService {
	private readonly logger: LoggerService;

	constructor(
		@InjectRepository(ApiRequestLogEntity)
		private readonly requestLogRepo: Repository<ApiRequestLogEntity>,
		@InjectRepository(ApiRouteStatsEntity)
		private readonly routeStatsRepo: Repository<ApiRouteStatsEntity>,
		private readonly dataSource: DataSource,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('ApiMetricsService');
	}

	/**
	 * Get time-series metrics for routes.
	 * 
	 * Returns aggregated statistics grouped by time bucket.
	 */
	async getTimeSeriesMetrics(query: TimeSeriesQuery): Promise<ApiRouteStatsEntity[]> {
		const where: Record<string, unknown> = {
			bucketStart: Between(query.startTime, query.endTime),
			timeBucket: query.timeBucket,
		};

		if (query.route) {
			where.route = query.route;
		}

		if (query.method) {
			where.method = query.method;
		}

		return this.routeStatsRepo.find({
			where,
			order: {
				bucketStart: 'ASC',
				route: 'ASC',
			},
		});
	}

	/**
	 * Get per-route breakdown with aggregated statistics.
	 */
	async getRouteBreakdown(
		startTime: Date,
		endTime: Date,
		limit = 50,
	): Promise<
		Array<{
			route: string;
			method: HttpMethod;
			requestCount: number;
			errorCount: number;
			errorRate: number;
			avgLatency: number;
			p95Latency: number;
			p99Latency: number;
		}>
	> {
		// Get all logs for the time range
		const logs = await this.requestLogRepo.find({
			where: {
				timestamp: Between(startTime, endTime),
			},
		});

		// Group by route and method
		const grouped = new Map<string, ApiRequestLogEntity[]>();
		for (const log of logs) {
			const key = `${log.route}:${log.method}`;
			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)!.push(log);
		}

		// Calculate statistics for each group
		const results = Array.from(grouped.entries())
			.map(([key, groupLogs]) => {
				const [route, method] = key.split(':');
				const requestCount = groupLogs.length;
				const errorCount = groupLogs.filter((log) => log.hasError).length;
				const latencies = groupLogs.map((log) => log.latencyMs).sort((a, b) => a - b);

				const percentile = (arr: number[], p: number): number => {
					if (arr.length === 0) return 0;
					const index = Math.ceil((p / 100) * arr.length) - 1;
					return arr[Math.max(0, index)];
				};

				const avgLatency =
					latencies.reduce((sum, val) => sum + val, 0) / latencies.length;

				return {
					route,
					method: method as HttpMethod,
					requestCount,
					errorCount,
					errorRate: errorCount / requestCount,
					avgLatency,
					p95Latency: percentile(latencies, 95),
					p99Latency: percentile(latencies, 99),
				};
			})
			.sort((a, b) => b.requestCount - a.requestCount)
			.slice(0, limit);

		return results;
	}

	/**
	 * Get activity for a specific actor.
	 */
	async getActorActivity(query: ActorActivityQuery): Promise<ApiRequestLogEntity[]> {
		return this.requestLogRepo.find({
			where: {
				actorId: query.actorId,
				timestamp: Between(query.startTime, query.endTime),
			},
			order: {
				timestamp: 'DESC',
			},
			take: query.limit,
		});
	}

	/**
	 * Get top external callers by request count.
	 */
	async getTopCallers(
		startTime: Date,
		endTime: Date,
		limit = 20,
		cursor?: string,
	): Promise<
		Array<{
			actorId: string;
			actorType: string;
			requestCount: number;
			errorCount: number;
		}>
	> {
		// Use raw SQL query to bypass TypeORM QueryBuilder aggregation issues
		// This ensures explicit GROUP BY with no implicit column selection
		const sql = `
			SELECT 
				"log"."actor_id" AS "actorId",
				"log"."actor_type" AS "actorType",
				COUNT(*) AS "requestCount",
				SUM(CASE WHEN "log"."has_error" = true THEN 1 ELSE 0 END) AS "errorCount"
			FROM "core"."api_request_log" AS "log"
			WHERE "log"."timestamp" >= $1::timestamptz
				AND "log"."timestamp" <= $2::timestamptz
				AND "log"."actor_id" IS NOT NULL
			GROUP BY "log"."actor_id", "log"."actor_type"
			ORDER BY "requestCount" DESC, "log"."actor_id" ASC
			LIMIT $3
		`;
		
		this.logger.info('Executing raw SQL query', {
			sql,
			params: [startTime.toISOString(), endTime.toISOString(), limit],
		});
		
		const results = await this.requestLogRepo.query(sql, [
			startTime.toISOString(),
			endTime.toISOString(),
			limit,
		]);
		
		this.logger.info('Raw SQL query results', {
			resultCount: results.length,
			firstResult: results[0] || null,
			allResults: results,
		});

		// Transform raw results to match expected format
		return results.map((row) => ({
			actorId: row.actorId || row.actor_id,
			actorType: row.actorType || row.actor_type || 'unknown',
			requestCount: parseInt(row.requestCount || row.request_count || '0', 10),
			errorCount: parseInt(row.errorCount || row.error_count || '0', 10),
		}));
	}

	/**
	 * Get error samples for analysis.
	 */
	async getErrorSamples(query: ErrorSampleQuery): Promise<ApiRequestLogEntity[]> {
		const where: Record<string, unknown> = {
			hasError: true,
			timestamp: Between(query.startTime, query.endTime),
		};

		if (query.classification) {
			where.errorClassification = query.classification;
		}

		if (query.route) {
			where.route = query.route;
		}

		return this.requestLogRepo.find({
			where,
			order: {
				timestamp: 'DESC',
			},
			take: query.limit,
		});
	}

	/**
	 * Calculate latency percentiles for a route.
	 * 
	 * This is used for aggregation into ApiRouteStatsEntity.
	 */
	async calculateLatencyPercentiles(
		route: string,
		method: HttpMethod,
		startTime: Date,
		endTime: Date,
	): Promise<{
		p50: number;
		p95: number;
		p99: number;
		min: number;
		max: number;
	}> {
		const latencies = await this.requestLogRepo
			.createQueryBuilder('log')
			.select('log.latencyMs', 'latencyMs')
			.where('log.route = :route', { route })
			.andWhere('log.method = :method', { method })
			.andWhere('log.timestamp BETWEEN :startTime AND :endTime', {
				startTime,
				endTime,
			})
			.orderBy('log.latencyMs', 'ASC')
			.getRawMany();

		if (latencies.length === 0) {
			return { p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
		}

		const sortedLatencies = latencies.map((r) => r.latencyMs).sort((a, b) => a - b);

		const percentile = (arr: number[], p: number): number => {
			const index = Math.ceil((p / 100) * arr.length) - 1;
			return arr[Math.max(0, index)];
		};

		return {
			p50: percentile(sortedLatencies, 50),
			p95: percentile(sortedLatencies, 95),
			p99: percentile(sortedLatencies, 99),
			min: sortedLatencies[0],
			max: sortedLatencies[sortedLatencies.length - 1],
		};
	}

	/**
	 * Aggregate route statistics for a time bucket.
	 * 
	 * This is typically called by a background worker to pre-aggregate
	 * statistics for fast dashboard queries.
	 */
	async aggregateRouteStats(
		route: string,
		method: HttpMethod,
		timeBucket: TimeBucket,
		bucketStart: Date,
		bucketEnd: Date,
	): Promise<void> {
		const logs = await this.requestLogRepo.find({
			where: {
				route,
				method,
				timestamp: Between(bucketStart, bucketEnd),
			},
		});

		if (logs.length === 0) {
			return;
		}

		const requestCount = logs.length;
		const errorCount = logs.filter((log) => log.hasError).length;

		const percentiles = await this.calculateLatencyPercentiles(
			route,
			method,
			bucketStart,
			bucketEnd,
		);

		// Calculate status code counts
		const statusCodeCounts: Record<string, number> = {};
		for (const log of logs) {
			const code = log.statusCode.toString();
			statusCodeCounts[code] = (statusCodeCounts[code] || 0) + 1;
		}

		// Upsert stats
		await this.routeStatsRepo.upsert(
			{
				route,
				method,
				timeBucket,
				bucketStart,
				requestCount,
				errorCount,
				latencyP50: percentiles.p50,
				latencyP95: percentiles.p95,
				latencyP99: percentiles.p99,
				latencyMin: percentiles.min,
				latencyMax: percentiles.max,
				statusCodeCounts,
			},
			['route', 'method', 'timeBucket', 'bucketStart'],
		);
	}
}

