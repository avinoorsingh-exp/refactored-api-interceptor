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
import {
	resolveTrendBucketType,
	calculateBucketCount,
	getWeekStart,
} from '../utils/bucket-resolution.util.js';
import type {
	TrendsResponseDto,
	TrendBucketMetricsDto,
	TrendsKpiSummaryDto,
	PeriodDeltaDto,
} from '../dto/trends-response.dto.js';
import { TrendsRange } from '../dto/trends-query.dto.js';

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

	/**
	 * Get trends metrics for long-term analysis.
	 * 
	 * Queries only aggregated tables (api_route_stats) with DAY buckets,
	 * then groups into daily or weekly buckets based on range.
	 * 
	 * Fixed ranges: 30, 60, 90 days.
	 * - Daily buckets for ranges ≤14 days
	 * - Weekly buckets for ranges >14 days
	 * 
	 * Performance optimizations:
	 * - Uses indexed columns (bucket_start, route, method)
	 * - Limits bucket counts (30 for 30 days, 13 for 90 days)
	 * - No joins to actor tables or raw request logs
	 * - KPI calculations done in service layer
	 * 
	 * @param range - Time range in days (30, 60, or 90)
	 * @param route - Optional route filter
	 * @param method - Optional HTTP method filter
	 * @returns Trends metrics with time-bucketed data and KPI summary
	 */
	async getTrendsMetrics(
		range: TrendsRange,
		route?: string,
		method?: HttpMethod,
	): Promise<TrendsResponseDto> {
		// Calculate time range
		const endTime = new Date();
		const startTime = new Date(endTime.getTime() - range * 24 * 60 * 60 * 1000);
		
		// Resolve bucket type using centralized logic
		const bucketType = resolveTrendBucketType(range);
		const expectedBucketCount = calculateBucketCount(range, bucketType);

		this.logger.debug('Fetching trends metrics', {
			range,
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			bucketType,
			expectedBucketCount,
			route,
			method,
		});

		// Query DAY buckets from aggregated table only
		const where: Record<string, unknown> = {
			bucketStart: Between(startTime, endTime),
			timeBucket: TimeBucket.DAY,
		};

		if (route) {
			where.route = route;
		}

		if (method) {
			where.method = method;
		}

		const dayStats = await this.routeStatsRepo.find({
			where,
			order: {
				bucketStart: 'ASC',
				route: 'ASC',
			},
		});

		// Group and aggregate into target buckets (daily or weekly)
		const buckets = this.aggregateIntoBuckets(dayStats, bucketType, startTime, endTime);

		// Calculate KPIs in service layer
		const kpiSummary = this.calculateKpiSummary(buckets, range);

		// Calculate period-over-period deltas if we have previous period data
		const previousPeriodDeltas = await this.calculatePeriodDeltas(
			range,
			startTime,
			kpiSummary,
			route,
			method,
		);
		
		if (previousPeriodDeltas) {
			kpiSummary.requestsPerDayDelta = previousPeriodDeltas.requestsPerDayDelta;
			kpiSummary.errorRateDelta = previousPeriodDeltas.errorRateDelta;
			kpiSummary.p95LatencyDelta = previousPeriodDeltas.p95LatencyDelta;
			kpiSummary.latencyVariabilityDelta = previousPeriodDeltas.latencyVariabilityDelta;
		}

		return {
			buckets,
			kpiSummary,
		};
	}

	/**
	 * Aggregate DAY buckets into daily or weekly buckets.
	 * 
	 * @param dayStats - DAY bucket statistics from api_route_stats
	 * @param bucketType - 'day' or 'week'
	 * @param startTime - Start of the time range
	 * @param endTime - End of the time range
	 * @returns Aggregated bucket metrics
	 */
	private aggregateIntoBuckets(
		dayStats: ApiRouteStatsEntity[],
		bucketType: 'day' | 'week',
		startTime: Date,
		endTime: Date,
	): TrendBucketMetricsDto[] {
		if (bucketType === 'day') {
			// For daily buckets, use DAY stats directly
			const bucketMap = new Map<string, ApiRouteStatsEntity[]>();
			
			for (const stat of dayStats) {
				const bucketKey = stat.bucketStart.toISOString().split('T')[0]; // YYYY-MM-DD
				if (!bucketMap.has(bucketKey)) {
					bucketMap.set(bucketKey, []);
				}
				bucketMap.get(bucketKey)!.push(stat);
			}

			// Generate all expected daily buckets (fill gaps with zeros)
			const buckets: TrendBucketMetricsDto[] = [];
			const currentDate = new Date(startTime);
			currentDate.setHours(0, 0, 0, 0);

			while (currentDate <= endTime) {
				const bucketKey = currentDate.toISOString().split('T')[0];
				const stats = bucketMap.get(bucketKey) || [];

				buckets.push(this.calculateBucketMetrics(stats, new Date(currentDate)));
				currentDate.setDate(currentDate.getDate() + 1);
			}

			return buckets;
		} else {
			// For weekly buckets, group DAY stats by week
			const weekMap = new Map<string, ApiRouteStatsEntity[]>();

			for (const stat of dayStats) {
				const weekStart = getWeekStart(stat.bucketStart);
				const weekKey = weekStart.toISOString();
				if (!weekMap.has(weekKey)) {
					weekMap.set(weekKey, []);
				}
				weekMap.get(weekKey)!.push(stat);
			}

			// Generate all expected weekly buckets (fill gaps with zeros)
			// Start from the week that contains startTime, end when we pass endTime
			const buckets: TrendBucketMetricsDto[] = [];
			let currentWeekStart = getWeekStart(startTime);

			// Continue until we've passed endTime
			while (currentWeekStart <= endTime) {
				const weekKey = currentWeekStart.toISOString();
				const stats = weekMap.get(weekKey) || [];

				buckets.push(this.calculateBucketMetrics(stats, new Date(currentWeekStart)));
				
				// Move to next week
				const nextWeek = new Date(currentWeekStart);
				nextWeek.setDate(nextWeek.getDate() + 7);
				currentWeekStart = nextWeek;
			}

			return buckets;
		}
	}

	/**
	 * Calculate metrics for a single bucket from aggregated stats.
	 * 
	 * @param stats - Array of ApiRouteStatsEntity for this bucket
	 * @param bucketStart - Start time of the bucket
	 * @returns Bucket metrics
	 */
	private calculateBucketMetrics(
		stats: ApiRouteStatsEntity[],
		bucketStart: Date,
	): TrendBucketMetricsDto {
		if (stats.length === 0) {
			// Handle missing data gracefully
			return {
				bucketStart,
				requestCount: 0,
				errorRate: 0,
				p95Latency: 0,
				latencyVariability: 0,
			};
		}

		// Aggregate across all routes/methods in this bucket
		const totalRequests = stats.reduce((sum, s) => sum + s.requestCount, 0);
		const totalErrors = stats.reduce((sum, s) => sum + s.errorCount, 0);
		const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

		// Calculate weighted average for p95 latency
		// Weight by request count
		let weightedP95Sum = 0;
		let totalWeight = 0;
		for (const stat of stats) {
			if (stat.latencyP95 !== null && stat.latencyP95 !== undefined && stat.requestCount > 0) {
				weightedP95Sum += stat.latencyP95 * stat.requestCount;
				totalWeight += stat.requestCount;
			}
		}
		const p95Latency = totalWeight > 0 ? Math.round(weightedP95Sum / totalWeight) : 0;

		// Calculate weighted average for latency variability (p99 - p50)
		let weightedVariabilitySum = 0;
		let variabilityWeight = 0;
		for (const stat of stats) {
			if (
				stat.latencyP99 !== null &&
				stat.latencyP99 !== undefined &&
				stat.latencyP50 !== null &&
				stat.latencyP50 !== undefined &&
				stat.requestCount > 0
			) {
				const variability = stat.latencyP99 - stat.latencyP50;
				weightedVariabilitySum += variability * stat.requestCount;
				variabilityWeight += stat.requestCount;
			}
		}
		const latencyVariability = variabilityWeight > 0 ? Math.round(weightedVariabilitySum / variabilityWeight) : 0;

		return {
			bucketStart,
			requestCount: totalRequests,
			errorRate,
			p95Latency,
			latencyVariability,
		};
	}

	/**
	 * Calculate KPI summary for the trends period.
	 * 
	 * @param buckets - Time-bucketed metrics
	 * @param rangeDays - Number of days in the range
	 * @returns KPI summary
	 */
	private calculateKpiSummary(
		buckets: TrendBucketMetricsDto[],
		rangeDays: number,
	): TrendsKpiSummaryDto {
		if (buckets.length === 0) {
			return {
				avgRequestsPerDay: 0,
				overallErrorRate: 0,
				avgP95Latency: 0,
				avgLatencyVariability: 0,
			};
		}

		const totalRequests = buckets.reduce((sum, b) => sum + b.requestCount, 0);
		const totalErrors = buckets.reduce((sum, b) => sum + b.requestCount * b.errorRate, 0);
		const avgRequestsPerDay = totalRequests / rangeDays;
		const overallErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

		// Calculate weighted averages for latency metrics
		let weightedP95Sum = 0;
		let weightedVariabilitySum = 0;
		let totalWeight = 0;

		for (const bucket of buckets) {
			if (bucket.requestCount > 0) {
				weightedP95Sum += bucket.p95Latency * bucket.requestCount;
				weightedVariabilitySum += bucket.latencyVariability * bucket.requestCount;
				totalWeight += bucket.requestCount;
			}
		}

		const avgP95Latency = totalWeight > 0 ? Math.round(weightedP95Sum / totalWeight) : 0;
		const avgLatencyVariability = totalWeight > 0 ? Math.round(weightedVariabilitySum / totalWeight) : 0;

		return {
			avgRequestsPerDay: Math.round(avgRequestsPerDay),
			overallErrorRate,
			avgP95Latency,
			avgLatencyVariability,
		};
	}

	/**
	 * Calculate period-over-period deltas by comparing with previous period.
	 * 
	 * @param range - Current range in days
	 * @param currentStartTime - Start time of current period
	 * @param currentKpis - Current period KPIs (already calculated)
	 * @param route - Optional route filter
	 * @param method - Optional HTTP method filter
	 * @returns Period deltas or null if previous period data unavailable
	 */
	private async calculatePeriodDeltas(
		range: TrendsRange,
		currentStartTime: Date,
		currentKpis: TrendsKpiSummaryDto,
		route?: string,
		method?: HttpMethod,
	): Promise<{
		requestsPerDayDelta: PeriodDeltaDto;
		errorRateDelta: PeriodDeltaDto;
		p95LatencyDelta: PeriodDeltaDto;
		latencyVariabilityDelta: PeriodDeltaDto;
	} | null> {
		// Calculate previous period time range
		const previousEndTime = new Date(currentStartTime);
		const previousStartTime = new Date(previousEndTime.getTime() - range * 24 * 60 * 60 * 1000);

		// Query previous period DAY buckets
		const where: Record<string, unknown> = {
			bucketStart: Between(previousStartTime, previousEndTime),
			timeBucket: TimeBucket.DAY,
		};

		if (route) {
			where.route = route;
		}

		if (method) {
			where.method = method;
		}

		const previousDayStats = await this.routeStatsRepo.find({
			where,
			order: {
				bucketStart: 'ASC',
			},
		});

		// If no previous period data, return null
		if (previousDayStats.length === 0) {
			return null;
		}

		// Aggregate previous period into buckets
		const bucketType = resolveTrendBucketType(range);
		const previousBuckets = this.aggregateIntoBuckets(
			previousDayStats,
			bucketType,
			previousStartTime,
			previousEndTime,
		);

		// Calculate previous period KPIs
		const previousKpis = this.calculateKpiSummary(previousBuckets, range);

		// Calculate deltas
		const calculateDelta = (current: number, previous: number): PeriodDeltaDto => {
			const absolute = current - previous;
			const percentage = previous !== 0 ? ((absolute / previous) * 100) : (absolute !== 0 ? 100 : 0);
			return {
				absolute: Math.round(absolute * 100) / 100, // Round to 2 decimals
				percentage: Math.round(percentage * 100) / 100,
			};
		};

		return {
			requestsPerDayDelta: calculateDelta(currentKpis.avgRequestsPerDay, previousKpis.avgRequestsPerDay),
			errorRateDelta: calculateDelta(currentKpis.overallErrorRate, previousKpis.overallErrorRate),
			p95LatencyDelta: calculateDelta(currentKpis.avgP95Latency, previousKpis.avgP95Latency),
			latencyVariabilityDelta: calculateDelta(
				currentKpis.avgLatencyVariability,
				previousKpis.avgLatencyVariability,
			),
		};
	}
}

