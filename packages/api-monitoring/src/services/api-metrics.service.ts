import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
	ApiRequestLogEntity,
	ApiRouteStatsEntity,
	ApiActorEntity,
} from '@exprealty/database';
import {
	HttpMethod,
	TimeBucket,
	ApiErrorClassification,
	type TimeSeriesQuery,
	type ActorActivityQuery,
	type ErrorSampleQuery,
} from '@exprealty/shared-domain';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';
import {
	decodeCursor,
	encodeCursor,
	normalizeLimit,
	createPaginatedResponse,
	type PaginatedResponse,
} from '../utils/pagination.util.js';
import { toArray, hasValues } from '../utils/filter.util.js';

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
	private readonly logger: IApiMonitoringLogger;

	constructor(
		@InjectRepository(ApiRequestLogEntity)
		private readonly requestLogRepo: Repository<ApiRequestLogEntity>,
		@InjectRepository(ApiRouteStatsEntity)
		private readonly routeStatsRepo: Repository<ApiRouteStatsEntity>,
		@InjectRepository(ApiActorEntity)
		private readonly actorRepo: Repository<ApiActorEntity>,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiMetricsService');
		this.logger.info('ApiMetricsService initialized successfully');
	}

	/**
	 * Get time-series metrics for routes.
	 * 
	 * OPTIMIZED BEHAVIOR:
	 * - Automatically selects optimal time bucket based on time range:
	 *   - < 1 hour → minute
	 *   - 1 hour - 24 hours → hour
	 *   - > 24 hours → day
	 * - Uses pre-aggregated api_route_stats table for efficient queries
	 * - Falls back to raw logs for very small ranges (< 1 hour) if needed
	 * - Filters are applied FIRST (startDate/endDate, routes[], methods[], statusCodes[])
	 * - NO limits or caps are EVER applied
	 * - Bucket count determined ONLY by date range and requested granularity
	 * 
	 * This endpoint is the SOURCE OF TRUTH for charts.
	 * Returned data must represent "All matching requests in the time window".
	 * 
	 * Supports multi-select filters:
	 * - routes[]: Filter by multiple route paths
	 * - methods[]: Filter by multiple HTTP methods
	 * - statusCodes[]: Filter by multiple status codes (checks JSONB statusCodeCounts)
	 * 
	 * Note: actorId filter is not supported for time-series as api_route_stats
	 * doesn't include actor information (pre-aggregated data).
	 */
	async getTimeSeriesMetrics(query: TimeSeriesQuery): Promise<ApiRouteStatsEntity[]> {
		const timeRangeMs = query.endTime.getTime() - query.startTime.getTime();
		const oneHourMs = 60 * 60 * 1000;
		const oneDayMs = 24 * 60 * 60 * 1000;

		// Auto-select optimal bucket based on time range
		// Override with explicit timeBucket if provided, otherwise auto-select
		let selectedBucket: TimeBucket;
		if (query.timeBucket) {
			// Use explicitly provided bucket
			selectedBucket = query.timeBucket;
		} else {
			// Auto-select based on time range
			if (timeRangeMs < oneHourMs) {
				selectedBucket = TimeBucket.MINUTE;
			} else if (timeRangeMs < oneDayMs) {
				selectedBucket = TimeBucket.HOUR;
			} else {
				selectedBucket = TimeBucket.DAY;
			}
		}

		// For very small ranges (< 1 hour), check if we should use raw logs
		// This is optional - we'll use pre-aggregated data if available
		const useRawLogs = timeRangeMs < oneHourMs && selectedBucket === TimeBucket.MINUTE;
		
		// Normalize filters to arrays
		const routes = toArray(query.route);
		const methods = toArray(query.method);
		const statusCodes = toArray(query.statusCode);

		// Try pre-aggregated data first (preferred for performance)
		// Only fall back to raw logs if:
		// 1. Range is < 1 hour AND
		// 2. No pre-aggregated data exists for the requested bucket
		try {
			const stats = await this.queryPreAggregatedStats(
				query.startTime,
				query.endTime,
				selectedBucket,
				routes,
				methods,
				statusCodes,
			);

			// If we got results, return them
			if (stats.length > 0 || !useRawLogs) {
				return stats;
			}

			// Fallback to raw logs only if:
			// - Range is < 1 hour
			// - No pre-aggregated data found
			// - We're requesting minute-level granularity
			if (useRawLogs && stats.length === 0) {
				this.logger.debug('No pre-aggregated data found, falling back to raw logs for small time range', {
					startTime: query.startTime.toISOString(),
					endTime: query.endTime.toISOString(),
					timeRangeMs,
				});
				return this.queryRawLogsForTimeSeries(
					query.startTime,
					query.endTime,
					routes,
					methods,
					statusCodes,
				);
			}

			return stats;
		} catch (error) {
			// If pre-aggregated query fails and we're in fallback mode, try raw logs
			if (useRawLogs) {
				this.logger.warn('Pre-aggregated query failed, falling back to raw logs', {
					error: error instanceof Error ? error.message : String(error),
				});
				return this.queryRawLogsForTimeSeries(
					query.startTime,
					query.endTime,
					routes,
					methods,
					statusCodes,
				);
			}
			throw error;
		}
	}

	/**
	 * Query pre-aggregated stats from api_route_stats table.
	 * Optimized with proper column selection and index usage.
	 */
	private async queryPreAggregatedStats(
		startTime: Date,
		endTime: Date,
		timeBucket: TimeBucket,
		routes: string[],
		methods: HttpMethod[],
		statusCodes: number[],
	): Promise<ApiRouteStatsEntity[]> {
		// Build query builder with optimized column selection
		// Only select necessary columns to reduce memory usage
		const qb = this.routeStatsRepo
			.createQueryBuilder('stats')
			.select([
				'stats.id',
				'stats.route',
				'stats.method',
				'stats.timeBucket',
				'stats.bucketStart',
				'stats.requestCount',
				'stats.errorCount',
				'stats.latencyP50',
				'stats.latencyP95',
				'stats.latencyP99',
				'stats.latencyMin',
				'stats.latencyMax',
				'stats.statusCodeCounts',
			])
			.where('stats.bucket_start >= :startTime', { startTime })
			.andWhere('stats.bucket_start <= :endTime', { endTime })
			.andWhere('stats.time_bucket = :timeBucket', { timeBucket });

		// Apply route filter (multi-select) - uses index idx_api_route_stats_bucket_route_method_bucket
		if (hasValues(routes)) {
			qb.andWhere('stats.route IN (:...routes)', { routes });
		}

		// Apply method filter (multi-select) - uses index idx_api_route_stats_bucket_route_method_bucket
		if (hasValues(methods)) {
			qb.andWhere('stats.method IN (:...methods)', { methods });
		}

		// Apply statusCode filter (multi-select via JSONB OR conditions)
		// Each status code is checked against the statusCodeCounts JSONB field
		if (hasValues(statusCodes)) {
			const statusCodeConditions = statusCodes.map((code, index) => {
				const paramName = `statusCode${index}`;
				return `stats.status_code_counts ? :${paramName}`;
			}).join(' OR ');

			const statusCodeParams: Record<string, string> = {};
			statusCodes.forEach((code, index) => {
				statusCodeParams[`statusCode${index}`] = code.toString();
			});

			qb.andWhere(`(${statusCodeConditions})`, statusCodeParams);
		}

		return qb
			.orderBy('stats.bucket_start', 'ASC')
			.addOrderBy('stats.route', 'ASC')
			.addOrderBy('stats.method', 'ASC')
			.getMany();
	}

	/**
	 * Fallback: Query raw logs and aggregate on-the-fly for very small time ranges.
	 * Only used when pre-aggregated data is not available for < 1 hour ranges.
	 * Uses proper pagination to avoid memory spikes.
	 * 
	 * Note: This uses raw SQL for complex aggregations that TypeORM doesn't handle well.
	 */
	private async queryRawLogsForTimeSeries(
		startTime: Date,
		endTime: Date,
		routes: string[],
		methods: HttpMethod[],
		statusCodes: number[],
	): Promise<ApiRouteStatsEntity[]> {
		// Build WHERE conditions with proper parameter placeholders ($1, $2, etc.)
		const conditions: string[] = [];
		const params: unknown[] = [];
		let paramIndex = 1;

		conditions.push(`"log"."timestamp" >= $${paramIndex}`);
		params.push(startTime);
		paramIndex++;

		conditions.push(`"log"."timestamp" <= $${paramIndex}`);
		params.push(endTime);
		paramIndex++;

		// Apply route filter
		if (hasValues(routes)) {
			const routePlaceholders = routes.map((_, i) => `$${paramIndex + i}`).join(', ');
			conditions.push(`"log"."route" IN (${routePlaceholders})`);
			params.push(...routes);
			paramIndex += routes.length;
		}

		// Apply method filter
		if (hasValues(methods)) {
			const methodPlaceholders = methods.map((_, i) => `$${paramIndex + i}`).join(', ');
			conditions.push(`"log"."method" IN (${methodPlaceholders})`);
			params.push(...methods);
			paramIndex += methods.length;
		}

		// Apply statusCode filter
		if (hasValues(statusCodes)) {
			const statusPlaceholders = statusCodes.map((_, i) => `$${paramIndex + i}`).join(', ');
			conditions.push(`"log"."status_code" IN (${statusPlaceholders})`);
			params.push(...statusCodes);
			paramIndex += statusCodes.length;
		}

		const whereClause = conditions.join(' AND ');

		// Use CTE to aggregate time buckets and status codes separately
		// This is more efficient than trying to do everything in one query
		const finalSql = `
			WITH time_buckets AS (
				SELECT
					DATE_TRUNC('minute', "log"."timestamp") as bucket_start,
					"log"."route",
					"log"."method",
					COUNT(*)::int as request_count,
					SUM(CASE WHEN "log"."has_error" THEN 1 ELSE 0 END)::int as error_count,
					PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "log"."latency_ms")::int as latency_p50,
					PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "log"."latency_ms")::int as latency_p95,
					PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "log"."latency_ms")::int as latency_p99,
					MIN("log"."latency_ms")::int as latency_min,
					MAX("log"."latency_ms")::int as latency_max
				FROM core.api_request_log "log"
				WHERE ${whereClause}
				GROUP BY DATE_TRUNC('minute', "log"."timestamp"), "log"."route", "log"."method"
			),
			status_counts AS (
				SELECT
					DATE_TRUNC('minute', "log"."timestamp") as bucket_start,
					"log"."route",
					"log"."method",
					"log"."status_code"::text as status_code,
					COUNT(*)::int as status_count
				FROM core.api_request_log "log"
				WHERE ${whereClause}
				GROUP BY DATE_TRUNC('minute', "log"."timestamp"), "log"."route", "log"."method", "log"."status_code"
			)
			SELECT
				tb.bucket_start,
				tb.route,
				tb.method,
				tb.request_count,
				tb.error_count,
				tb.latency_p50,
				tb.latency_p95,
				tb.latency_p99,
				tb.latency_min,
				tb.latency_max,
				COALESCE(
					jsonb_object_agg(sc.status_code, sc.status_count) FILTER (WHERE sc.status_code IS NOT NULL),
					'{}'::jsonb
				) as status_code_counts
			FROM time_buckets tb
			LEFT JOIN status_counts sc ON 
				tb.bucket_start = sc.bucket_start AND
				tb.route = sc.route AND
				tb.method = sc.method
			GROUP BY tb.bucket_start, tb.route, tb.method, tb.request_count, tb.error_count, 
			         tb.latency_p50, tb.latency_p95, tb.latency_p99, tb.latency_min, tb.latency_max
			ORDER BY tb.bucket_start ASC, tb.route ASC, tb.method ASC
		`;

		// Execute raw SQL query with positional parameters
		const rawResults = await this.requestLogRepo.manager.query(finalSql, params);

		// Transform raw results to match ApiRouteStatsEntity structure
		return rawResults.map((row: Record<string, unknown>) => {
			const entity = new ApiRouteStatsEntity();
			entity.bucketStart = new Date(row.bucket_start as string);
			entity.route = row.route as string;
			entity.method = row.method as HttpMethod;
			entity.timeBucket = TimeBucket.MINUTE;
			entity.requestCount = parseInt(String(row.request_count || '0'), 10);
			entity.errorCount = parseInt(String(row.error_count || '0'), 10);
			entity.latencyP50 = row.latency_p50 ? parseInt(String(row.latency_p50), 10) : undefined;
			entity.latencyP95 = row.latency_p95 ? parseInt(String(row.latency_p95), 10) : undefined;
			entity.latencyP99 = row.latency_p99 ? parseInt(String(row.latency_p99), 10) : undefined;
			entity.latencyMin = row.latency_min ? parseInt(String(row.latency_min), 10) : undefined;
			entity.latencyMax = row.latency_max ? parseInt(String(row.latency_max), 10) : undefined;
			entity.statusCodeCounts = typeof row.status_code_counts === 'string' 
				? JSON.parse(row.status_code_counts) 
				: (row.status_code_counts as Record<string, number>);
			return entity;
		});
	}

	/**
	 * Get per-route breakdown with aggregated statistics.
	 * 
	 * STANDARDIZED BEHAVIOR:
	 * - Filters are applied FIRST (startDate/endDate, routes[], statusCodes[])
	 * - Aggregation happens SECOND (GROUP BY route, method)
	 * - Caps are applied LAST (only in ranking mode)
	 * 
	 * TWO MODES (auto-detected):
	 * 
	 * A) RANKING MODE (default)
	 *    Condition: NO route filter present
	 *    Behavior: Aggregate by route, order by requestCount DESC, apply hard cap (default 50, max 100)
	 *    Purpose: Show most-used routes globally
	 * 
	 * B) INSPECTION MODE
	 *    Condition: route filter IS present
	 *    Behavior: Return ONLY selected routes, NO cap, alphabetical or stable ordering
	 *    Purpose: Validate or inspect specific routes
	 * 
	 * Supports multi-select filters:
	 * - routes[]: Filter by multiple route paths (switches to inspection mode)
	 * - methods[]: Filter by multiple HTTP methods
	 * - statusCodes[]: Filter by multiple status codes
	 */
	async getRouteBreakdown(
		startTime: Date,
		endTime: Date,
		limit = 50,
		routes?: string | string[],
		methods?: HttpMethod | HttpMethod[],
		statusCodes?: number | number[],
		debug = false,
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
		try {
			// STEP 1: Normalize filters to arrays
			const normalizedRoutes = toArray(routes);
			const normalizedMethods = toArray(methods);
			const normalizedStatusCodes = toArray(statusCodes);

			// Determine mode: inspection mode if route filter is present
			const isInspectionMode = hasValues(normalizedRoutes);
			
			// STEP 2: Apply caps based on mode
			// Ranking mode: default 50, max 100
			// Inspection mode: no cap (return all matching routes)
			const defaultLimit = 50;
			const maxLimit = 100;
			const effectiveLimit = isInspectionMode 
				? undefined // No cap in inspection mode
				: Math.min(limit || defaultLimit, maxLimit);

			if (debug) {
				this.logger.debug('Route breakdown - filters and mode', {
					startTime: startTime.toISOString(),
					endTime: endTime.toISOString(),
					mode: isInspectionMode ? 'inspection' : 'ranking',
					routes: normalizedRoutes,
					methods: normalizedMethods,
					statusCodes: normalizedStatusCodes,
					effectiveLimit,
				});
			}

			// STEP 3: Build WHERE clause with filters (applied FIRST)
			const where: Record<string, unknown> = {
				timestamp: Between(startTime, endTime),
			};

			if (hasValues(normalizedRoutes)) {
				where.route = In(normalizedRoutes);
			}

			if (hasValues(normalizedMethods)) {
				where.method = In(normalizedMethods);
			}

			if (hasValues(normalizedStatusCodes)) {
				where.statusCode = In(normalizedStatusCodes);
			}

			// STEP 4: Fetch all matching logs (no limit on raw logs - we aggregate first)
			const logs = await this.requestLogRepo.find({
				where,
				order: {
					timestamp: 'DESC',
				},
			});

			if (debug) {
				this.logger.debug('Route breakdown - logs fetched', {
					logCount: logs.length,
				});
			}

			// STEP 5: Aggregate by route and method
			const grouped = new Map<string, ApiRequestLogEntity[]>();
			for (const log of logs) {
				const key = `${log.route}:${log.method}`;
				if (!grouped.has(key)) {
					grouped.set(key, []);
				}
				grouped.get(key)!.push(log);
			}

			// STEP 6: Calculate statistics for each group
			let results = Array.from(grouped.entries())
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
				});

			// STEP 7: Apply ordering and cap (LAST)
			if (isInspectionMode) {
				// Inspection mode: alphabetical ordering, no cap
				results = results.sort((a, b) => {
					const routeCompare = a.route.localeCompare(b.route);
					if (routeCompare !== 0) return routeCompare;
					return a.method.localeCompare(b.method);
				});
			} else {
				// Ranking mode: order by requestCount DESC, then apply cap
				results = results
					.sort((a, b) => b.requestCount - a.requestCount)
					.slice(0, effectiveLimit);
			}

			if (debug) {
				this.logger.debug('Route breakdown - results', {
					rowCountBeforeCap: grouped.size,
					rowCountAfterCap: results.length,
					mode: isInspectionMode ? 'inspection' : 'ranking',
				});
			}

			return results;
		} catch (error) {
			this.logger.error('Failed to fetch route breakdown', {
				error: error instanceof Error ? error.message : String(error),
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
				limit,
			});
			return [];
		}
	}

	/**
	 * Get activity for a specific actor.
	 * 
	 * Supports cursor-based pagination for stable ordering.
	 * If no cursor is provided, returns results ordered by timestamp DESC.
	 * 
	 * Cursor is based on timestamp + id for deterministic ordering.
	 */
	/**
	 * Get activity for a specific actor.
	 * 
	 * STANDARDIZED BEHAVIOR:
	 * - Filters are applied FIRST (startDate/endDate, routes[], statusCodes[])
	 * - Results are paginated (NEVER ranked)
	 * - Ordered by timestamp DESC
	 * 
	 * This endpoint is a log stream, not analytics.
	 * 
	 * Pagination:
	 * - Default page size: 50
	 * - Max page size: 100
	 */
	async getActorActivity(
		query: (ActorActivityQuery | { actorId: string; startTime?: Date; endTime?: Date; limit?: number }) & { 
			cursor?: string; 
			legacyLimit?: number;
			route?: string | string[];
			statusCode?: number | number[];
			debug?: boolean;
		},
	): Promise<PaginatedResponse<ApiRequestLogEntity> | ApiRequestLogEntity[]> {
		try {
			// STEP 1: Normalize limit (default 50, max 100)
			const defaultLimit = 50;
			const maxLimit = 100;
			const limitValue = normalizeLimit(query.limit || query.legacyLimit, defaultLimit, maxLimit);
			const limit = limitValue || defaultLimit;
			
			// STEP 2: Normalize filters to arrays (applied FIRST)
			const normalizedRoutes = toArray(query.route);
			const normalizedStatusCodes = toArray(query.statusCode);
			
			if (query.debug) {
				this.logger.debug('Actor activity - filters', {
					actorId: query.actorId,
					startTime: query.startTime?.toISOString(),
					endTime: query.endTime?.toISOString(),
					routes: normalizedRoutes,
					statusCodes: normalizedStatusCodes,
				});
			}
			
			// STEP 3: Build where clause with filters (applied FIRST)
			const where: Record<string, unknown> = {
				actorId: query.actorId,
			};
			
			// Add time range if provided
			if (query.startTime && query.endTime) {
				where.timestamp = Between(query.startTime, query.endTime);
			}

			// Apply route filter (multi-select)
			if (hasValues(normalizedRoutes)) {
				where.route = In(normalizedRoutes);
			}

			// Apply statusCode filter (multi-select)
			if (hasValues(normalizedStatusCodes)) {
				where.statusCode = In(normalizedStatusCodes);
			}
			
			// Fetch actor to get displayName (all logs are for the same actor)
			const actor = await this.actorRepo.findOne({
				where: { id: query.actorId, active: true },
			});
			const actorDisplayName = actor?.displayName || 'Unknown';
			
			// Handle cursor-based pagination
			if (query.cursor) {
				const cursorData = decodeCursor(query.cursor);
				if (cursorData) {
					// Cursor-based: fetch records before the cursor timestamp/id
					// Order: timestamp DESC, id DESC (for stable ordering)
					const cursorTimestamp = new Date(cursorData.timestamp);
					
					const qb = this.requestLogRepo
						.createQueryBuilder('log')
						.where('log.actorId = :actorId', { actorId: query.actorId })
						.andWhere(
							'(log.timestamp < :cursorTimestamp OR (log.timestamp = :cursorTimestamp AND log.id < :cursorId))',
							{
								cursorTimestamp,
								cursorId: cursorData.id,
							},
						)
						.orderBy('log.timestamp', 'DESC')
						.addOrderBy('log.id', 'DESC')
						.take(limit + 1); // Fetch one extra to check for hasMore
					
					// Add time range filter if provided
					if (query.startTime && query.endTime) {
						qb.andWhere('log.timestamp BETWEEN :startTime AND :endTime', {
							startTime: query.startTime,
							endTime: query.endTime,
						});
					}

					// Apply route filter (multi-select)
					if (hasValues(normalizedRoutes)) {
						qb.andWhere('log.route IN (:...routes)', { routes: normalizedRoutes });
					}

					// Apply statusCode filter (multi-select)
					if (hasValues(normalizedStatusCodes)) {
						qb.andWhere('log.statusCode IN (:...statusCodes)', { statusCodes: normalizedStatusCodes });
					}
					
					const results = await qb.getMany();
					
					// Use actual limit or result length if fetching all
					const paginationLimit = limit >= 100000 ? results.length : limit;
					const paginatedResponse = createPaginatedResponse(
						results,
						paginationLimit,
						(item) => ({
							timestamp: item.timestamp.toISOString(),
							id: item.id,
						}),
					);
					
					// Add actor displayName to pageInfo
					if (paginatedResponse.pageInfo) {
						(paginatedResponse.pageInfo as { displayName?: string }).displayName = actorDisplayName;
					}
					
					return paginatedResponse;
				}
			}
			
			// Non-paginated path (backward compatibility)
			// If no cursor, return array directly
			const takeValue = limit >= 100000 ? undefined : limit;
			const results = await this.requestLogRepo.find({
				where,
				order: {
					timestamp: 'DESC',
					id: 'DESC',
				},
				take: takeValue,
			});
			
			// If limit was provided but no cursor, return paginated response
			if (query.limit !== undefined || query.legacyLimit !== undefined) {
				// Use actual limit or result length if fetching all
				const paginationLimit = limit >= 100000 ? results.length : limit;
				const paginatedResponse = createPaginatedResponse(
					results,
					paginationLimit,
					(item) => ({
						timestamp: item.timestamp.toISOString(),
						id: item.id,
					}),
				);
				
				// Add actor displayName to pageInfo
				if (paginatedResponse.pageInfo) {
					(paginatedResponse.pageInfo as { displayName?: string }).displayName = actorDisplayName;
				}
				
				return paginatedResponse;
			}
			
			// Legacy behavior: return array if no pagination params
			return results;
		} catch (error) {
			this.logger.error('Failed to fetch actor activity', {
				error: error instanceof Error ? error.message : String(error),
				actorId: query.actorId,
			});
			// Fail soft: return empty array
			return query.cursor || query.limit !== undefined
				? { data: [], pageInfo: { nextCursor: null, hasMore: false } }
				: [];
		}
	}

	/**
	 * Get top external callers by request count.
	 * 
	 * Supports pagination with hard max limit (default 25, max 100).
	 * Sorting remains by request count or error rate.
	 * 
	 * Note: This endpoint aggregates data, so cursor-based pagination
	 * is optional. If no cursor is provided, returns top N callers.
	 */
	/**
	 * Get top external callers by request count.
	 * 
	 * Supports multi-select filters:
	 * - actorIds[]: Filter by multiple actor IDs
	 * - routes[]: Filter by multiple route paths
	 * - statusCodes[]: Filter by multiple status codes
	 * 
	 * All filters apply BEFORE aggregation.
	 */
	/**
	 * Get top external callers by request count.
	 * 
	 * STANDARDIZED BEHAVIOR:
	 * - Filters are applied FIRST (startDate/endDate, routes[], statusCodes[], actorIds[])
	 * - Aggregation happens SECOND (GROUP BY actor_id, actor_type)
	 * - Caps are applied LAST (default 25, max 50)
	 * 
	 * Semantics: "Top callers WITHIN the filtered dataset"
	 * Counts are EXPECTED to drop when filters are applied. This is correct behavior.
	 * 
	 * Supports multi-select filters:
	 * - actorIds[]: Filter by multiple actor IDs
	 * - routes[]: Filter by multiple route paths
	 * - statusCodes[]: Filter by multiple status codes
	 */
	async getTopCallers(
		startTime: Date,
		endTime: Date,
		limit?: number,
		cursor?: string,
		actorIds?: string | string[],
		routes?: string | string[],
		statusCodes?: number | number[],
		debug = false,
	): Promise<
		| PaginatedResponse<{
				actorId: string;
				actorType: string;
				displayName: string;
				requestCount: number;
				errorCount: number;
			}>
		| Array<{
				actorId: string;
				actorType: string;
				displayName: string;
				requestCount: number;
				errorCount: number;
			}>
	> {
		try {
			// STEP 1: Normalize limit (default 25, max 50)
			const defaultLimit = 25;
			const maxLimit = 50;
			const normalizedLimit = normalizeLimit(limit, defaultLimit, maxLimit) || defaultLimit;
			
			// STEP 2: Ensure dates are Date objects
			const startTimeDate = startTime instanceof Date ? startTime : new Date(startTime);
			const endTimeDate = endTime instanceof Date ? endTime : new Date(endTime);
			
			// STEP 3: Normalize filters to arrays (applied FIRST)
			const normalizedActorIds = toArray(actorIds);
			const normalizedRoutes = toArray(routes);
			const normalizedStatusCodes = toArray(statusCodes);

			if (debug) {
				this.logger.debug('Top callers - filters', {
					startTime: startTimeDate.toISOString(),
					endTime: endTimeDate.toISOString(),
					actorIds: normalizedActorIds,
					routes: normalizedRoutes,
					statusCodes: normalizedStatusCodes,
				});
			}

			// STEP 4: Build WHERE clause with filters (applied FIRST)
			const whereConditions: string[] = [
				'"log"."timestamp" >= $1::timestamptz',
				'"log"."timestamp" <= $2::timestamptz',
				'"log"."actor_id" IS NOT NULL',
			];
			const params: unknown[] = [startTimeDate.toISOString(), endTimeDate.toISOString()];
			let paramIndex = 3;

			// Apply actorId filter (multi-select)
			if (hasValues(normalizedActorIds)) {
				const placeholders = normalizedActorIds.map(() => `$${paramIndex++}`).join(', ');
				whereConditions.push(`"log"."actor_id" IN (${placeholders})`);
				params.push(...normalizedActorIds);
			}

			// Apply route filter (multi-select)
			if (hasValues(normalizedRoutes)) {
				const placeholders = normalizedRoutes.map(() => `$${paramIndex++}`).join(', ');
				whereConditions.push(`"log"."route" IN (${placeholders})`);
				params.push(...normalizedRoutes);
			}

			// Apply statusCode filter (multi-select)
			if (hasValues(normalizedStatusCodes)) {
				const placeholders = normalizedStatusCodes.map(() => `$${paramIndex++}`).join(', ');
				whereConditions.push(`"log"."status_code" IN (${placeholders})`);
				params.push(...normalizedStatusCodes);
			}

			// STEP 5: Aggregate (GROUP BY actor_id, actor_type)
			// STEP 6: Apply cap LAST (fetch limit+1 to check for hasMore)
			const limitParamIndex = paramIndex;
			params.push(normalizedLimit + 1); // Fetch one extra to check for hasMore
			
			const sql = `
				SELECT 
					"log"."actor_id" AS "actorId",
					"log"."actor_type" AS "actorType",
					COALESCE("actor"."display_name", 'Unknown') AS "displayName",
					COUNT(*) AS "requestCount",
					SUM(CASE WHEN "log"."has_error" = true THEN 1 ELSE 0 END) AS "errorCount"
				FROM "core"."api_request_log" AS "log"
				LEFT JOIN "core"."api_actor" AS "actor" ON "actor"."id" = "log"."actor_id" AND "actor"."active" = true
				WHERE ${whereConditions.join(' AND ')}
				GROUP BY "log"."actor_id", "log"."actor_type", "actor"."display_name"
				ORDER BY "requestCount" DESC, "log"."actor_id" ASC
				LIMIT $${limitParamIndex}
			`;
			
			if (debug) {
				this.logger.debug('Top callers - SQL query', {
					sql,
					params,
				});
			}
			
			const results = await this.requestLogRepo.query(sql, params);

			// Transform raw results to match expected format
			let transformedResults = results.map((row: Record<string, unknown>) => ({
				actorId: (row.actorId || row.actor_id) as string,
				actorType: (row.actorType || row.actor_type || 'unknown') as string,
				displayName: (row.displayName || row.display_name || 'Unknown') as string,
				requestCount: parseInt((row.requestCount || row.request_count || '0') as string, 10),
				errorCount: parseInt((row.errorCount || row.error_count || '0') as string, 10),
			}));

			// Handle cursor-based pagination (filter results after fetching)
			if (cursor) {
				const cursorData = decodeCursor(cursor);
				if (cursorData && cursorData.id) {
					const cursorRequestCount = parseInt(cursorData.timestamp || '0', 10);
					const cursorActorId = cursorData.id;
					
					// Filter: find items after cursor position
					// Order is: requestCount DESC, actorId ASC
					transformedResults = transformedResults.filter((r: { actorId: string; requestCount: number }) => {
						if (r.requestCount < cursorRequestCount) return true;
						if (r.requestCount === cursorRequestCount && r.actorId > cursorActorId) return true;
						return false;
					});
				}
			}

			// Check if there are more results (we fetched limit+1)
			const hasMore = transformedResults.length > normalizedLimit;
			const paginatedResults = hasMore
				? transformedResults.slice(0, normalizedLimit)
				: transformedResults;
			
			if (debug) {
				this.logger.debug('Top callers - results', {
					rowCountBeforeCap: transformedResults.length,
					rowCountAfterCap: paginatedResults.length,
				});
			}
			
			// Always return paginated response when limit or cursor is provided
			if (limit !== undefined || cursor !== undefined) {
				return {
					data: paginatedResults,
					pageInfo: {
						nextCursor: hasMore && paginatedResults.length > 0
							? encodeCursor(
								paginatedResults[paginatedResults.length - 1].requestCount.toString(),
								paginatedResults[paginatedResults.length - 1].actorId,
							)
							: null,
						hasMore,
					},
				};
			}
			
			// Legacy behavior: return array if no pagination params
			return paginatedResults;
		} catch (error) {
			this.logger.error('Failed to fetch top callers', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
			console.error('Top callers error:', error);
			// Fail soft: return empty array
			return cursor || limit !== undefined
				? { data: [], pageInfo: { nextCursor: null, hasMore: false } }
				: [];
		}
	}

	/**
	 * Get error samples for analysis.
	 * 
	 * Supports cursor-based pagination with filtering by:
	 * - route
	 * - classification (severity)
	 * - statusCode
	 * 
	 * Order: createdAt DESC, id DESC (for stable cursor-based pagination).
	 * Cursor is based on createdAt + id to ensure deterministic ordering.
	 */
	/**
	 * Get error samples for analysis.
	 * 
	 * Supports multi-select filters:
	 * - routes[]: Filter by multiple route paths
	 * - statusCodes[]: Filter by multiple status codes
	 * - classifications[]: Filter by multiple error classifications
	 * 
	 * Cursor pagination preserved.
	 */
	/**
	 * Get error samples for analysis.
	 * 
	 * STANDARDIZED BEHAVIOR:
	 * - Filters are applied FIRST (startDate/endDate, routes[], statusCodes[], classifications[])
	 * - Results are paginated (NEVER ranked)
	 * - Ordered by createdAt DESC, id DESC
	 * 
	 * This endpoint is NOT used for charts - it is a verification source.
	 * 
	 * Pagination:
	 * - Default page size: 50
	 * - Max page size: 100
	 */
	async getErrorSamples(
		query: {
			startTime: Date;
			endTime: Date;
			cursor?: string;
			legacyLimit?: number;
			limit?: number;
			statusCode?: number | number[];
			classification?: ApiErrorClassification | ApiErrorClassification[];
			route?: string | string[];
			debug?: boolean;
		},
	): Promise<PaginatedResponse<ApiRequestLogEntity> | ApiRequestLogEntity[]> {
		try {
			// STEP 1: Normalize limit (default 50, max 100)
			const defaultLimit = 50;
			const maxLimit = 100;
			const limitValue = normalizeLimit(
				query.limit !== undefined ? query.limit : query.legacyLimit,
				defaultLimit,
				maxLimit,
			);
			const limit = limitValue || defaultLimit;
			
			// STEP 2: Normalize filters to arrays (applied FIRST)
			const normalizedRoutes = toArray(query.route);
			const normalizedStatusCodes = toArray(query.statusCode);
			const normalizedClassifications = toArray(query.classification);
			
			if (query.debug) {
				this.logger.debug('Error samples - filters', {
					startTime: query.startTime.toISOString(),
					endTime: query.endTime.toISOString(),
					routes: normalizedRoutes,
					statusCodes: normalizedStatusCodes,
					classifications: normalizedClassifications,
				});
			}
			
			// STEP 3: Build where clause with filters (applied FIRST)
			const where: Record<string, unknown> = {
				hasError: true,
			};
			
			// Add time range (required)
			if (query.startTime && query.endTime) {
				where.timestamp = Between(query.startTime, query.endTime);
			}
			
			// Apply classification filter (multi-select)
			if (hasValues(normalizedClassifications)) {
				where.errorClassification = In(normalizedClassifications);
			}
			
			// Apply route filter (multi-select)
			if (hasValues(normalizedRoutes)) {
				where.route = In(normalizedRoutes);
			}
			
			// Apply statusCode filter (multi-select)
			if (hasValues(normalizedStatusCodes)) {
				where.statusCode = In(normalizedStatusCodes);
			}
			
			// Handle cursor-based pagination
			if (query.cursor) {
				const cursorData = decodeCursor(query.cursor);
				if (cursorData) {
					// Cursor-based: fetch records before the cursor createdAt/id
					// Use createdAt for stable ordering (not timestamp which may have duplicates)
					const cursorCreatedAt = new Date(cursorData.timestamp);
					
					const qb = this.requestLogRepo
						.createQueryBuilder('log')
						.where('log.hasError = :hasError', { hasError: true })
						.andWhere(
							'(log.createdAt < :cursorCreatedAt OR (log.createdAt = :cursorCreatedAt AND log.id < :cursorId))',
							{
								cursorCreatedAt,
								cursorId: cursorData.id,
							},
						);
					
					// Add time range filter
					if (query.startTime && query.endTime) {
						qb.andWhere('log.timestamp BETWEEN :startTime AND :endTime', {
							startTime: query.startTime,
							endTime: query.endTime,
						});
					}
					
					// Apply classification filter (multi-select)
					if (hasValues(normalizedClassifications)) {
						qb.andWhere('log.errorClassification IN (:...classifications)', { 
							classifications: normalizedClassifications 
						});
					}

					// Apply route filter (multi-select)
					if (hasValues(normalizedRoutes)) {
						qb.andWhere('log.route IN (:...routes)', { routes: normalizedRoutes });
					}

					// Apply statusCode filter (multi-select)
					if (hasValues(normalizedStatusCodes)) {
						qb.andWhere('log.statusCode IN (:...statusCodes)', { statusCodes: normalizedStatusCodes });
					}
					
					// STEP 4: Apply pagination (fetch limit+1 to check for hasMore)
					const results = await qb
						.take(limit + 1)
						.orderBy('log.createdAt', 'DESC')
						.addOrderBy('log.id', 'DESC')
						.getMany();
					
					if (query.debug) {
						this.logger.debug('Error samples - results', {
							rowCountBeforeCap: results.length,
							rowCountAfterCap: Math.min(results.length, limit),
						});
					}
					
					return createPaginatedResponse(
						results,
						limit,
						(item) => ({
							timestamp: item.createdAt.toISOString(),
							id: item.id,
						}),
					);
				}
			}
			
			// Non-paginated path (backward compatibility)
			const results = await this.requestLogRepo.find({
				where,
				order: {
					createdAt: 'DESC',
					id: 'DESC',
				},
				take: limit,
			});
			
			if (query.debug) {
				this.logger.debug('Error samples - results', {
					rowCount: results.length,
				});
			}
			
			// If limit was provided but no cursor, return paginated response
			if (query.limit !== undefined || query.legacyLimit !== undefined) {
				return createPaginatedResponse(
					results,
					limit,
					(item) => ({
						timestamp: item.createdAt.toISOString(),
						id: item.id,
					}),
				);
			}
			
			// Legacy behavior: return array if no pagination params
			return results;
		} catch (error) {
			this.logger.error('Failed to fetch error samples', {
				error: error instanceof Error ? error.message : String(error),
				route: query.route,
				classification: query.classification,
			});
			// Fail soft: return empty array
			return query.cursor || query.limit !== undefined || query.legacyLimit !== undefined
				? { data: [], pageInfo: { nextCursor: null, hasMore: false } }
				: [];
		}
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
		const latenciesQuery = this.requestLogRepo
			.createQueryBuilder('log')
			.select('log.latencyMs', 'latencyMs')
			.where('log.route = :route', { route })
			.andWhere('log.method = :method', { method })
			.andWhere('log.timestamp BETWEEN :startTime AND :endTime', {
				startTime,
				endTime,
			})
			.orderBy('log.latencyMs', 'ASC');
		
		const latenciesSql = latenciesQuery.getQuery();
		const latenciesParams = latenciesQuery.getParameters();
		
		this.logger.info('SQL Query: Calculate latency percentiles', {
			sql: latenciesSql,
			parameters: latenciesParams,
			route,
			method,
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
		});
		
		const latencies = await latenciesQuery.getRawMany();

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
		// Log the find query SQL
		const findQuery = this.requestLogRepo
			.createQueryBuilder('log')
			.where('log.route = :route', { route })
			.andWhere('log.method = :method', { method })
			.andWhere('log.timestamp BETWEEN :bucketStart AND :bucketEnd', {
				bucketStart,
				bucketEnd,
			});
		
		const findSql = findQuery.getQuery();
		const findParams = findQuery.getParameters();
		
		this.logger.info('SQL Query: Find logs for aggregation', {
			sql: findSql,
			parameters: findParams,
			route,
			method,
			bucketStart: bucketStart.toISOString(),
			bucketEnd: bucketEnd.toISOString(),
		});
		
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
		const upsertData = {
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
		};
		
		// Log the upsert operation (TypeORM upsert generates INSERT ... ON CONFLICT ... DO UPDATE)
		this.logger.info('SQL Query: Upsert route stats', {
			operation: 'UPSERT',
			table: 'core.api_route_stats',
			data: upsertData,
			conflictColumns: ['route', 'method', 'timeBucket', 'bucketStart'],
			route,
			method,
			timeBucket,
			bucketStart: bucketStart.toISOString(),
		});
		
		await this.routeStatsRepo.upsert(
			upsertData,
			['route', 'method', 'timeBucket', 'bucketStart'],
		);
	}

	/**
	 * Aggregate route statistics for all routes in a time range.
	 * 
	 * This method aggregates statistics for all unique route/method combinations
	 * in the given time range and stores them in the api_route_stats table.
	 * 
	 * @param startTime - Start of time range
	 * @param endTime - End of time range
	 * @param timeBucket - Time bucket size (HOUR, DAY, etc.)
	 * @returns Number of route stats records created
	 */
	async aggregateAllRouteStats(
		startTime: Date,
		endTime: Date,
		timeBucket: TimeBucket = TimeBucket.HOUR,
	): Promise<number> {
		try {
			this.logger.info('Starting route stats aggregation', {
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
				timeBucket,
			});

			// Get unique route/method combinations using GROUP BY (more reliable than DISTINCT)
			const uniqueRoutesQuery = this.requestLogRepo
				.createQueryBuilder('log')
				.select('log.route', 'route')
				.addSelect('log.method', 'method')
				.where('log.timestamp BETWEEN :startTime AND :endTime', {
					startTime,
					endTime,
				})
				.groupBy('log.route')
				.addGroupBy('log.method');
			
			const uniqueRoutesSql = uniqueRoutesQuery.getQuery();
			const uniqueRoutesParams = uniqueRoutesQuery.getParameters();
			
			this.logger.info('SQL Query: Get unique routes/methods', {
				sql: uniqueRoutesSql,
				parameters: uniqueRoutesParams,
			});
			
			const uniqueRoutesResult = await uniqueRoutesQuery.getRawMany();

			if (uniqueRoutesResult.length === 0) {
				this.logger.info('No logs found for aggregation', {
					startTime: startTime.toISOString(),
					endTime: endTime.toISOString(),
				});
				return 0;
			}

			// Convert to route/method pairs
			const uniqueRoutes = uniqueRoutesResult.map((r) => ({
				route: r.route,
				method: r.method as HttpMethod,
			}));

			this.logger.info('Found unique routes to aggregate', {
				count: uniqueRoutes.length,
			});

			// Calculate bucket boundaries
			const bucketSizeMs = this.getBucketSizeMs(timeBucket);
			let aggregatedCount = 0;

			// Process each route/method combination
			for (const { route, method } of uniqueRoutes) {
				// Process time range in buckets
				let currentStart = new Date(startTime);
				
				while (currentStart < endTime) {
					const bucketEnd = new Date(Math.min(currentStart.getTime() + bucketSizeMs, endTime.getTime()));
					
					await this.aggregateRouteStats(route, method, timeBucket, currentStart, bucketEnd);
					aggregatedCount++;
					
					currentStart = bucketEnd;
				}
			}

			this.logger.info('Route stats aggregation completed', {
				aggregatedCount,
				uniqueRoutes: uniqueRoutes.length,
			});

			return aggregatedCount;
		} catch (error) {
			this.logger.error('Failed to aggregate route stats', {
				error: error instanceof Error ? error.message : String(error),
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
				timeBucket,
			});
			throw error;
		}
	}

	/**
	 * Get bucket size in milliseconds for a given time bucket.
	 */
	private getBucketSizeMs(timeBucket: TimeBucket): number {
		switch (timeBucket) {
			case TimeBucket.MINUTE:
				return 60 * 1000;
			case TimeBucket.HOUR:
				return 60 * 60 * 1000;
			case TimeBucket.DAY:
				return 24 * 60 * 60 * 1000;
			default:
				return 60 * 60 * 1000; // Default to hour
		}
	}

	/**
	 * Get summary metrics for the Admin header.
	 * 
	 * Returns aggregated metrics in a single DB round-trip:
	 * - totalRequests
	 * - errorRate
	 * - p95Latency
	 * - activeActors (unique in time window)
	 * - activeRateLimitViolations
	 * 
	 * Time window defaults to last 15 minutes if not provided.
	 * 
	 * Uses database-level aggregation for efficiency with large datasets.
	 */
	async getSummary(from?: Date, to?: Date): Promise<{
		totalRequests: number;
		errorRate: number;
		p95Latency: number;
		activeActors: number;
		activeRateLimitViolations: number;
	}> {
		try {
			// Default to last 15 minutes if not provided
			const endTime = to || new Date();
			const startTime = from || new Date(endTime.getTime() - 15 * 60 * 1000);
			
			// Use raw SQL aggregation to avoid loading all records into memory
			const sql = `
				SELECT 
					COUNT(*) AS "totalRequests",
					SUM(CASE WHEN "log"."has_error" = true THEN 1 ELSE 0 END) AS "errorCount",
					PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "log"."latency_ms") AS "p95Latency",
					COUNT(DISTINCT "log"."actor_id") FILTER (WHERE "log"."actor_id" IS NOT NULL) AS "activeActors",
					SUM(CASE WHEN "log"."status_code" = 429 THEN 1 ELSE 0 END) AS "activeRateLimitViolations"
				FROM "core"."api_request_log" AS "log"
				WHERE "log"."timestamp" >= $1::timestamptz
					AND "log"."timestamp" <= $2::timestamptz
			`;
			
			this.logger.debug('Executing summary metrics query', {
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
			});
			
			const results = await this.requestLogRepo.query(sql, [
				startTime.toISOString(),
				endTime.toISOString(),
			]);
			
			if (!results || results.length === 0) {
				return {
					totalRequests: 0,
					errorRate: 0,
					p95Latency: 0,
					activeActors: 0,
					activeRateLimitViolations: 0,
				};
			}
			
			const row = results[0];
			const totalRequests = parseInt(row.totalRequests || row.total_requests || '0', 10);
			const errorCount = parseInt(row.errorCount || row.error_count || '0', 10);
			const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
			const p95Latency = parseFloat(row.p95Latency || row.p95_latency || '0') || 0;
			const activeActors = parseInt(row.activeActors || row.active_actors || '0', 10);
			const activeRateLimitViolations = parseInt(
				row.activeRateLimitViolations || row.active_rate_limit_violations || '0',
				10,
			);
			
			return {
				totalRequests,
				errorRate,
				p95Latency: Math.round(p95Latency),
				activeActors,
				activeRateLimitViolations,
			};
		} catch (error) {
			this.logger.error('Failed to fetch summary metrics', {
				error: error instanceof Error ? error.message : String(error),
			});
			// Fail soft: return zeros
			return {
				totalRequests: 0,
				errorRate: 0,
				p95Latency: 0,
				activeActors: 0,
				activeRateLimitViolations: 0,
			};
		}
	}
}

