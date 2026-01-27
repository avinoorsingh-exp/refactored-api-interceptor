import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';
import {
	decodeCursor,
	encodeCursor,
	normalizeLimit,
	createPaginatedResponse,
	type PaginatedResponse,
} from '../utils/pagination.util.js';

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
		try {
			this.logger.debug('Fetching route breakdown', {
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
				limit,
			});

			// Get all logs for the time range
			// Use LessThanOrEqual for endTime to include the end boundary
			const logs = await this.requestLogRepo.find({
				where: {
					timestamp: Between(startTime, endTime),
				},
				order: {
					timestamp: 'DESC',
				},
				take: 10000, // Safety limit to prevent memory issues
			});

			this.logger.debug('Found logs for route breakdown', {
				logCount: logs.length,
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
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

			this.logger.debug('Route breakdown results', {
				resultCount: results.length,
			});

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
	async getActorActivity(
		query: (ActorActivityQuery | { actorId: string; startTime?: Date; endTime?: Date; limit?: number }) & { cursor?: string; legacyLimit?: number },
	): Promise<PaginatedResponse<ApiRequestLogEntity> | ApiRequestLogEntity[]> {
		try {
			// Normalize limit (default 100, max 200)
			const limit = normalizeLimit(query.limit || query.legacyLimit, 100, 200);
			
			// Build where clause
			const where: Record<string, unknown> = {
				actorId: query.actorId,
			};
			
			// Add time range if provided (backward compatibility)
			if (query.startTime && query.endTime) {
				where.timestamp = Between(query.startTime, query.endTime);
			}
			
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
					
					const results = await qb.getMany();
					
					return createPaginatedResponse(
						results,
						limit,
						(item) => ({
							timestamp: item.timestamp.toISOString(),
							id: item.id,
						}),
					);
				}
			}
			
			// Non-paginated path (backward compatibility)
			// If no cursor, return array directly
			const results = await this.requestLogRepo.find({
				where,
				order: {
					timestamp: 'DESC',
					id: 'DESC',
				},
				take: query.limit || 100,
			});
			
			// If limit was provided but no cursor, return paginated response
			if (query.limit !== undefined) {
				return createPaginatedResponse(
					results,
					limit,
					(item) => ({
						timestamp: item.timestamp.toISOString(),
						id: item.id,
					}),
				);
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
	async getTopCallers(
		startTime: Date,
		endTime: Date,
		limit?: number,
		cursor?: string,
	): Promise<
		| PaginatedResponse<{
				actorId: string;
				actorType: string;
				requestCount: number;
				errorCount: number;
			}>
		| Array<{
				actorId: string;
				actorType: string;
				requestCount: number;
				errorCount: number;
			}>
	> {
		try {
			// Normalize limit (default 25, max 100)
			const normalizedLimit = normalizeLimit(limit, 25, 100);
			
			// Ensure dates are Date objects for TypeORM
			const startTimeDate = startTime instanceof Date ? startTime : new Date(startTime);
			const endTimeDate = endTime instanceof Date ? endTime : new Date(endTime);
			
			// Debug: Check total requests in time range
			const totalRequestsInRange = await this.requestLogRepo
				.createQueryBuilder('log')
				.where('log.timestamp >= :startTime', { startTime: startTimeDate })
				.andWhere('log.timestamp <= :endTime', { endTime: endTimeDate })
				.getCount();
			
			const requestsWithActor = await this.requestLogRepo
				.createQueryBuilder('log')
				.where('log.timestamp >= :startTime', { startTime: startTimeDate })
				.andWhere('log.timestamp <= :endTime', { endTime: endTimeDate })
				.andWhere('log.actorId IS NOT NULL')
				.getCount();
			
			this.logger.info('Top callers query stats', {
				startTime: startTimeDate.toISOString(),
				endTime: endTimeDate.toISOString(),
				totalRequestsInRange,
				requestsWithActor,
			});
			
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
			
			this.logger.info('Executing raw SQL query for top callers', {
				sql,
				params: [startTimeDate.toISOString(), endTimeDate.toISOString(), normalizedLimit],
			});
			
			const results = await this.requestLogRepo.query(sql, [
				startTimeDate.toISOString(),
				endTimeDate.toISOString(),
				normalizedLimit,
			]);
			
			this.logger.info('Raw SQL query results', {
				resultCount: results.length,
				firstResult: results[0] || null,
			});

			// Transform raw results to match expected format
			// Handle both camelCase and snake_case column names from raw SQL
			let transformedResults = results.map((row: Record<string, unknown>) => ({
				actorId: (row.actorId || row.actor_id) as string,
				actorType: (row.actorType || row.actor_type || 'unknown') as string,
				requestCount: parseInt((row.requestCount || row.request_count || '0') as string, 10),
				errorCount: parseInt((row.errorCount || row.error_count || '0') as string, 10),
			}));

			// Handle cursor-based pagination
			if (cursor) {
				const cursorData = decodeCursor(cursor);
				if (cursorData && cursorData.id) {
					// Find the index of the cursor actor
					const cursorIndex = transformedResults.findIndex((r: { actorId: string }) => r.actorId === cursorData.id);
					if (cursorIndex >= 0) {
						// Start from the next item after cursor
						transformedResults = transformedResults.slice(cursorIndex + 1);
					}
				}
			}

			// Check if there are more results
			const hasMore = transformedResults.length > normalizedLimit;
			const paginatedResults = hasMore
				? transformedResults.slice(0, normalizedLimit)
				: transformedResults;
			
			// If cursor or limit was provided, return paginated response
			if (cursor || limit !== undefined) {
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
	async getErrorSamples(
		query: ErrorSampleQuery & { cursor?: string; legacyLimit?: number; statusCode?: number },
	): Promise<PaginatedResponse<ApiRequestLogEntity> | ApiRequestLogEntity[]> {
		try {
			// Normalize limit (default 50, max 200)
			// Use limit from ErrorSampleQuery if provided, otherwise use legacyLimit
			const limit = normalizeLimit(
				query.limit !== undefined ? query.limit : query.legacyLimit,
				50,
				200,
			);
			
			// Build where clause
			const where: Record<string, unknown> = {
				hasError: true,
			};
			
			// Add time range (required for backward compatibility)
			if (query.startTime && query.endTime) {
				where.timestamp = Between(query.startTime, query.endTime);
			}
			
			if (query.classification) {
				where.errorClassification = query.classification;
			}
			
			if (query.route) {
				where.route = query.route;
			}
			
			if (query.statusCode) {
				where.statusCode = query.statusCode;
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
					
					// Add filters
					if (query.classification) {
						qb.andWhere('log.errorClassification = :classification', {
							classification: query.classification,
						});
					}
					
					if (query.route) {
						qb.andWhere('log.route = :route', { route: query.route });
					}
					
					if (query.statusCode) {
						qb.andWhere('log.statusCode = :statusCode', { statusCode: query.statusCode });
					}
					
					const results = await qb
						.orderBy('log.createdAt', 'DESC')
						.addOrderBy('log.id', 'DESC')
						.take(limit + 1) // Fetch one extra to check for hasMore
						.getMany();
					
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
				take: query.limit || query.legacyLimit || 50,
			});
			
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
			const uniqueRoutesResult = await this.requestLogRepo
				.createQueryBuilder('log')
				.select('log.route', 'route')
				.addSelect('log.method', 'method')
				.where('log.timestamp BETWEEN :startTime AND :endTime', {
					startTime,
					endTime,
				})
				.groupBy('log.route')
				.addGroupBy('log.method')
				.getRawMany();

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
			
			// Single query to get all logs in time window
			const logs = await this.requestLogRepo.find({
				where: {
					timestamp: Between(startTime, endTime),
				},
			});
			
			if (logs.length === 0) {
				return {
					totalRequests: 0,
					errorRate: 0,
					p95Latency: 0,
					activeActors: 0,
					activeRateLimitViolations: 0,
				};
			}
			
			// Calculate metrics
			const totalRequests = logs.length;
			const errorCount = logs.filter((log) => log.hasError).length;
			const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
			
			// Calculate p95 latency
			const latencies = logs.map((log) => log.latencyMs).sort((a, b) => a - b);
			const p95Index = Math.ceil(0.95 * latencies.length) - 1;
			const p95Latency = latencies.length > 0 ? latencies[Math.max(0, p95Index)] : 0;
			
			// Count unique actors
			const uniqueActors = new Set<string>();
			for (const log of logs) {
				if (log.actorId) {
					uniqueActors.add(log.actorId);
				}
			}
			const activeActors = uniqueActors.size;
			
			// Count rate limit violations (429 status code)
			const activeRateLimitViolations = logs.filter(
				(log) => log.statusCode === 429,
			).length;
			
			return {
				totalRequests,
				errorRate,
				p95Latency,
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

