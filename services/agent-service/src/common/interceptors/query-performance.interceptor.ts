// services/listing-provider/src/common/interceptors/query-performance.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import type { LoggerService } from '../../core/logger.service.js';

/**
 * Query performance options
 */
export interface QueryPerformanceOptions {
  slowQueryThresholdMs: number;
  criticalQueryThresholdMs: number;
  logAllQueries: boolean;
  captureExplain: 'off' | 'slow' | 'critical' | 'all';
  includeInResponse: boolean;
  /** Fraction of requests to instrument (0..1). Default: 1.0 */
  sampleRate: number;
  /** If set, only instrument requests whose path starts with one of these prefixes. */
  endpointAllowlist: string[];
}

/**
 * EXPLAIN ANALYZE result
 */
export interface ExplainResult {
  plan: string;
  executionTime: number;
  planningTime: number;
  hasSequentialScan: boolean;
  estimatedRows: number;
  actualRows: number;
  nodeTypes: string[];
}

/**
 * Connection pool metrics
 */
export interface PoolMetrics {
  total: number;
  idle: number;
  active: number;
  waiting: number;
}

/**
 * Complete query metadata with performance
 */
export interface CompleteQueryMetadata {
  search?: string;
  filter?: Record<string, any>;
  sort?: string | any[];
  pagination: {
    offset: number;
    limit: number;
    page?: number;
    pageSize?: number;
  };
  performance: {
    durationMs: number;
    timestamp: string;
    source?: string;
    sql?: string;
    parameters?: any[];
    explain?: ExplainResult;
    connectionPool?: PoolMetrics;
    warnings?: string[];
  };
}

interface QueryCapture {
  sql: string;
  parameters?: any[];
  duration?: number;
  timestamp: Date;
}

interface QueryContext {
  correlationId: string;
  method: string;
  path: string;
  controller: string;
  handler: string;
  startTime: number;
}

/**
 * Enhanced Query Performance Interceptor
 * 
 * Captures query execution details including:
 * - SQL text and parameters
 * - EXPLAIN ANALYZE for slow queries
 * - Connection pool metrics
 * - Sequential scan detection with warnings
 * 
 * @example
 * ```typescript
 * @UseInterceptors(QueryPerformanceInterceptor)
 * @Get()
 * async findAll(@Query() params: ListingQueryDto) {
 *   return this.listingService.findAll(params);
 * }
 * ```
 */
@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly queryBuffer: Map<string, QueryCapture[]> = new Map();
  private originalLogQuery: ((query: string, parameters?: any[]) => void) | null = null;

  constructor(
    @Optional() @Inject(DataSource) private readonly dataSource?: DataSource,
    @Optional() @Inject('QUERY_PERFORMANCE_OPTIONS')
    private readonly options: Partial<QueryPerformanceOptions> = {},
    private readonly logger?: LoggerService,
  ) {
    // Set defaults
    this.options = {
      slowQueryThresholdMs: options.slowQueryThresholdMs ?? 2000,
      criticalQueryThresholdMs: options.criticalQueryThresholdMs ?? 10000,
      logAllQueries: options.logAllQueries ?? false,
      captureExplain: options.captureExplain ?? 'slow',
      includeInResponse: options.includeInResponse ?? false,
      sampleRate: options.sampleRate ?? 1.0,
      endpointAllowlist: options.endpointAllowlist ?? [],
    };
  }

  /**
   * Check if this request should be instrumented based on sample rate and endpoint allowlist.
   */
  private shouldInstrument(request: Request): boolean {
    // Sampling: random check against configured rate
    const sampleRate = this.options.sampleRate ?? 1.0;
    if (sampleRate < 1.0 && Math.random() > sampleRate) {
      return false;
    }

    // Endpoint allowlist: if set, only instrument matching paths
    const allowlist = this.options.endpointAllowlist ?? [];
    if (allowlist.length > 0) {
      const path = request.path || request.url.split('?')[0];
      const matched = allowlist.some((prefix) => path.startsWith(prefix));
      if (!matched) return false;
    }

    return true;
  }

  /**
   * Determine whether EXPLAIN should be captured for a given request duration.
   */
  private shouldCaptureExplain(totalDurationMs: number): boolean {
    const mode = this.options.captureExplain ?? 'slow';
    if (mode === 'off') return false;
    if (mode === 'all') return true;
    if (mode === 'critical') return totalDurationMs >= (this.options.criticalQueryThresholdMs ?? 10000);
    // 'slow' (default)
    return totalDurationMs >= (this.options.slowQueryThresholdMs ?? 2000);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const queryParams = request.query;
    const correlationId = (request.headers['x-correlation-id'] as string) || this.generateId();

    // Skip full instrumentation if not sampled or not in allowlist
    const instrumented = this.shouldInstrument(request);

    // Build query context
    const queryContext: QueryContext = {
      correlationId,
      method: request.method,
      path: request.url,
      controller: context.getClass().name,
      handler: context.getHandler().name,
      startTime,
    };

    // Build query metadata
    const queryMetadata: CompleteQueryMetadata = {
      pagination: {
        offset: parseInt(queryParams.offset as string) || 0,
        limit: parseInt(queryParams.limit as string) || 25,
        page: queryParams.page ? parseInt(queryParams.page as string) : undefined,
        pageSize: queryParams.pageSize ? parseInt(queryParams.pageSize as string) : undefined,
      },
      performance: {
        durationMs: 0,
        timestamp,
        source: `${queryContext.controller}.${queryContext.handler}`,
      },
    };

    // Include search
    if (queryParams.search) {
      queryMetadata.search = queryParams.search as string;
    }

    // Include filter
    if (queryParams.filter) {
      try {
        queryMetadata.filter =
          typeof queryParams.filter === 'string'
            ? JSON.parse(queryParams.filter)
            : queryParams.filter;
      } catch {
        queryMetadata.filter = queryParams.filter as any;
      }
    }

    // Include sort
    if (queryParams.sort || queryParams.sortBy) {
      try {
        const sortValue = queryParams.sort || queryParams.sortBy;
        queryMetadata.sort =
          typeof sortValue === 'string'
            ? sortValue.includes('{')
              ? JSON.parse(sortValue)
              : sortValue
            : sortValue;
      } catch {
        queryMetadata.sort = (queryParams.sort || queryParams.sortBy) as any;
      }
    }

    // Setup query capture only for instrumented requests
    if (instrumented) {
      this.setupQueryCapture(correlationId);
    }

    return next.handle().pipe(
      tap({
        next: async () => {
          const duration = Date.now() - startTime;
          queryMetadata.performance.durationMs = duration;

          // Get captured queries (only if instrumented)
          let queries: QueryCapture[] = [];
          if (instrumented) {
            queries = this.queryBuffer.get(correlationId) || [];
            this.queryBuffer.delete(correlationId);
            this.cleanupQueryCapture();
          }

          // Add headers (only if response hasn't been sent yet)
          // Some endpoints (like retry) manually send responses with @Res({ passthrough: false })
          if (!response.headersSent && !response.finished) {
            try {
              response.setHeader('X-Response-Time', `${duration}ms`);
              response.setHeader('X-Query-Timestamp', timestamp);
              response.setHeader('X-Correlation-ID', correlationId);
            } catch (headerError) {
              // Ignore header errors if response was already sent
              this.logger?.debugTiered('[Microscope] Could not set response headers (response already sent)', {
                channel: 'diagnostic',
                correlationId,
                error: (headerError as Error).message,
              });
            }
          }

          // Enhance metadata with query details (only for instrumented requests)
          if (instrumented) {
            await this.enhanceMetadata(queryMetadata, queries, duration, queryContext);
          }

          // Log based on duration (always, but SQL details only if instrumented)
          if (duration >= (this.options.criticalQueryThresholdMs ?? 10000)) {
            await this.handleCriticalQuery(queryMetadata, queryContext);
          } else if (duration >= (this.options.slowQueryThresholdMs ?? 2000)) {
            await this.handleSlowQuery(queryMetadata, queryContext);
          } else if (this.options.logAllQueries && instrumented) {
            this.logger?.debugTiered('[Microscope] Query completed', {
              channel: 'diagnostic',
              correlationId,
              endpoint: { method: request.method, path: request.url },
              perf: { durationMs: duration },
            });
          }
        },
        error: async (error) => {
          const duration = Date.now() - startTime;
          queryMetadata.performance.durationMs = duration;

          // Cleanup
          let queries: QueryCapture[] = [];
          if (instrumented) {
            queries = this.queryBuffer.get(correlationId) || [];
            this.queryBuffer.delete(correlationId);
            this.cleanupQueryCapture();
          }

          // Add headers (only if response hasn't been sent yet)
          if (!response.headersSent && !response.finished) {
            try {
              response.setHeader('X-Response-Time', `${duration}ms`);
              response.setHeader('X-Query-Timestamp', timestamp);
              response.setHeader('X-Correlation-ID', correlationId);
            } catch (headerError) {
              // Ignore header errors if response was already sent
              this.logger?.debugTiered('[Microscope] Could not set response headers on error (response already sent)', {
                channel: 'diagnostic',
                correlationId,
                error: (headerError as Error).message,
              });
            }
          }

          // Enhance metadata for error logging
          if (instrumented) {
            await this.enhanceMetadata(queryMetadata, queries, duration, queryContext);
          }

          this.logger?.critical('[Microscope] Query failed', {
            channel: 'diagnostic',
            correlationId,
            endpoint: { method: request.method, path: request.url },
            perf: { durationMs: duration },
            query: { sql: queryMetadata.performance.sql?.substring(0, 500) },
            error: error.message,
            warnings: queryMetadata.performance.warnings,
          });
        },
      }),
      map((data) => {
        // Update performance duration
        queryMetadata.performance.durationMs = Date.now() - startTime;

        // Skip wrapping for API monitoring routes (they return arrays directly)
        const isApiMonitoringRoute = request.url.startsWith('/v1/api-monitoring');

        // If response has meta, merge it
        if (data && typeof data === 'object' && 'meta' in data) {
          return {
            ...data,
            meta: {
              ...data.meta,
              query: queryMetadata,
            },
          };
        }

        // If response has items/total (from repository)
        if (data && typeof data === 'object' && 'items' in data && 'total' in data) {
          return {
            data: data.items,
            meta: {
              total: data.total,
              count: data.items.length,
              query: queryMetadata,
            },
          };
        }

        // Wrap array responses (but skip API monitoring routes)
        if (Array.isArray(data)) {
          // API monitoring routes should return arrays directly (matching dev/test behavior)
          if (isApiMonitoringRoute) {
            return data;
          }
          return {
            data,
            meta: {
              count: data.length,
              query: queryMetadata,
            },
          };
        }

        // Return single entities as-is
        return data;
      }),
    );
  }

  /**
   * Setup query capture for this request using TypeORM's logger
   */
  private setupQueryCapture(correlationId: string): void {
    const queries: QueryCapture[] = [];
    this.queryBuffer.set(correlationId, queries);

    if (!this.dataSource) return;

    // Hook into TypeORM's query logging
    try {
      const logger = this.dataSource.logger;
      if (logger && typeof logger.logQuery === 'function') {
        // Store original if not already stored
        if (!this.originalLogQuery) {
          this.originalLogQuery = logger.logQuery.bind(logger);
        }
        
        // Override to capture queries
        (logger as any).logQuery = (query: string, parameters?: any[]) => {
          queries.push({
            sql: query,
            parameters,
            timestamp: new Date(),
          });
          
          // Call original logger
          if (this.originalLogQuery) {
            this.originalLogQuery(query, parameters);
          }
        };
      }
    } catch (error) {
      this.logger?.debugTiered('[Microscope] Could not setup query capture', {
        channel: 'diagnostic',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Cleanup query capture hook
   */
  private cleanupQueryCapture(): void {
    if (!this.dataSource || !this.originalLogQuery) return;

    try {
      const logger = this.dataSource.logger;
      if (logger) {
        (logger as any).logQuery = this.originalLogQuery;
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Enhance metadata with SQL details and EXPLAIN
   */
  private async enhanceMetadata(
    metadata: CompleteQueryMetadata,
    queries: QueryCapture[],
    totalDuration: number,
    context: QueryContext,
  ): Promise<void> {
    // Add SQL details if queries captured
    if (queries.length > 0) {
      // Find the main query (usually longest or last SELECT)
      const mainQuery = this.findMainQuery(queries);
      
      if (mainQuery) {
        metadata.performance.sql = this.sanitizeSQL(mainQuery.sql);
        metadata.performance.parameters = this.sanitizeParameters(mainQuery.parameters);
      }
    }

    // Get connection pool metrics
    if (this.dataSource) {
      metadata.performance.connectionPool = this.getPoolMetrics();
    }

    // Trigger EXPLAIN based on configured captureExplain mode
    if (
      this.shouldCaptureExplain(totalDuration) &&
      this.dataSource &&
      queries.length > 0
    ) {
      const mainQuery = this.findMainQuery(queries);
      
      if (mainQuery && this.isExplainableQuery(mainQuery.sql)) {
        try {
          metadata.performance.explain = await this.explainQuery(
            mainQuery.sql,
            mainQuery.parameters,
          );
          
          metadata.performance.warnings = this.generateWarnings(
            metadata.performance.explain,
            totalDuration,
          );
        } catch (error) {
          this.logger?.operational('[Microscope] Failed to generate EXPLAIN', {
            channel: 'diagnostic',
            correlationId: context.correlationId,
            error: (error as Error).message,
          });
        }
      }
    }

    // Strip detailed info from response unless explicitly enabled
    if (!this.options.includeInResponse) {
      delete metadata.performance.sql;
      delete metadata.performance.parameters;
      delete metadata.performance.explain;
    }
  }

  /**
   * Find the main query from captured queries
   */
  private findMainQuery(queries: QueryCapture[]): QueryCapture | undefined {
    // Filter to SELECT queries (main data queries)
    const selectQueries = queries.filter(q => 
      q.sql.trim().toUpperCase().startsWith('SELECT') &&
      !q.sql.includes('SELECT 1') // Exclude health checks
    );

    if (selectQueries.length === 0) {
      return queries[queries.length - 1]; // Fall back to last query
    }

    // Return the longest SELECT (usually the main query)
    return selectQueries.reduce((longest, current) => 
      current.sql.length > longest.sql.length ? current : longest
    );
  }

  /**
   * Check if query can have EXPLAIN run on it
   */
  private isExplainableQuery(sql: string): boolean {
    const upperSQL = sql.trim().toUpperCase();
    return (
      upperSQL.startsWith('SELECT') ||
      upperSQL.startsWith('INSERT') ||
      upperSQL.startsWith('UPDATE') ||
      upperSQL.startsWith('DELETE')
    );
  }

  /**
   * Execute EXPLAIN ANALYZE and parse results
   */
  private async explainQuery(
    sql: string,
    parameters?: any[],
  ): Promise<ExplainResult> {
    if (!this.dataSource) {
      throw new Error('DataSource not available');
    }

    const explainSQL = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;

    try {
      const result = await this.dataSource.query(explainSQL, parameters);
      const plan = result[0]['QUERY PLAN'][0];
      
      return this.parseExplainOutput(plan);
    } catch (error) {
      this.logger?.critical('[Microscope] EXPLAIN ANALYZE failed', {
        channel: 'diagnostic',
        error: (error as Error).message,
        query: { sql: sql.substring(0, 200) },
      });
      throw error;
    }
  }

  /**
   * Parse EXPLAIN output
   */
  private parseExplainOutput(plan: any): ExplainResult {
    const executionTime = plan['Execution Time'] || 0;
    const planningTime = plan['Planning Time'] || 0;
    const mainPlan = plan['Plan'];

    // Recursively find all node types
    const nodeTypes = this.extractNodeTypes(mainPlan);
    const hasSequentialScan = nodeTypes.some(t => t === 'Seq Scan');

    return {
      plan: JSON.stringify(plan, null, 2),
      executionTime,
      planningTime,
      hasSequentialScan,
      estimatedRows: mainPlan['Plan Rows'] || 0,
      actualRows: mainPlan['Actual Rows'] || 0,
      nodeTypes,
    };
  }

  /**
   * Recursively extract node types from plan
   */
  private extractNodeTypes(node: any): string[] {
    if (!node) return [];
    
    const types: string[] = [node['Node Type']].filter(Boolean);

    if (node['Plans']) {
      for (const childPlan of node['Plans']) {
        types.push(...this.extractNodeTypes(childPlan));
      }
    }

    return types;
  }

  /**
   * Generate warnings from EXPLAIN output
   */
  private generateWarnings(explain: ExplainResult, totalDurationMs: number): string[] {
    const warnings: string[] = [];

    // Sequential scan warning
    if (explain.hasSequentialScan) {
      warnings.push(
        'PERF: Sequential scan detected - consider adding indexes to WHERE/ORDER BY columns',
      );
    }

    // Large row count mismatch (planner estimate vs actual)
    const rowDiff = Math.abs(explain.estimatedRows - explain.actualRows);
    if (rowDiff > 1000 && explain.estimatedRows > 0 && rowDiff / explain.estimatedRows > 0.5) {
      warnings.push(
        `STATS: Row estimate off by ${Math.round(rowDiff)} rows (est: ${explain.estimatedRows}, actual: ${explain.actualRows}) - run ANALYZE on table`,
      );
    }

    // Slow execution time
    if (explain.executionTime > 5000) {
      warnings.push(
        `CRITICAL: DB execution time ${Math.round(explain.executionTime)}ms exceeds 5 seconds`,
      );
    } else if (explain.executionTime > 2000) {
      warnings.push(
        `SLOW: DB execution time ${Math.round(explain.executionTime)}ms exceeds 2 seconds`,
      );
    }

    // High planning time
    if (explain.planningTime > 500) {
      warnings.push(
        `PLANNING: Planning time ${Math.round(explain.planningTime)}ms is high - may indicate complex query or stale statistics`,
      );
    }

    // Total time much higher than DB time (indicates application overhead)
    const appOverhead = totalDurationMs - explain.executionTime - explain.planningTime;
    if (appOverhead > 1000 && appOverhead > explain.executionTime) {
      warnings.push(
        `OVERHEAD: Application overhead ${Math.round(appOverhead)}ms exceeds DB time - check data transformation or network`,
      );
    }

    // Node types analysis
    if (explain.nodeTypes.includes('Nested Loop') && explain.actualRows > 10000) {
      warnings.push(
        'PERF: Nested loop on large result set - consider restructuring query or adding join indexes',
      );
    }

    return warnings;
  }

  /**
   * Get connection pool metrics
   */
  private getPoolMetrics(): PoolMetrics {
    if (!this.dataSource) {
      return { total: 0, idle: 0, active: 0, waiting: 0 };
    }

    try {
      const pool = (this.dataSource.driver as any).master;
      
      if (pool) {
        return {
          total: pool.totalCount || 0,
          idle: pool.idleCount || 0,
          active: (pool.totalCount || 0) - (pool.idleCount || 0),
          waiting: pool.waitingCount || 0,
        };
      }
    } catch {
      // Pool metrics not available
    }

    return { total: 0, idle: 0, active: 0, waiting: 0 };
  }

  /**
   * Build structured perf log payload from query metadata and context.
   */
  private buildPerfPayload(
    metadata: CompleteQueryMetadata,
    context: QueryContext,
    severity: 'slow' | 'critical',
    sqlTruncateLength: number,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      channel: 'diagnostic',
      correlationId: context.correlationId,
      endpoint: {
        method: context.method,
        path: context.path,
        controller: context.controller,
        handler: context.handler,
      },
      perf: {
        durationMs: metadata.performance.durationMs,
        thresholdMs: severity === 'critical'
          ? this.options.criticalQueryThresholdMs
          : this.options.slowQueryThresholdMs,
        severity,
      },
    };

    if (metadata.performance.sql) {
      payload.query = {
        sql: metadata.performance.sql.substring(0, sqlTruncateLength),
        parameters: metadata.performance.parameters,
      };
    }

    if (metadata.performance.explain) {
      payload.explain = {
        executionTimeMs: metadata.performance.explain.executionTime,
        planningTimeMs: metadata.performance.explain.planningTime,
        hasSeqScan: metadata.performance.explain.hasSequentialScan,
        estimatedRows: metadata.performance.explain.estimatedRows,
        actualRows: metadata.performance.explain.actualRows,
        nodeTypes: metadata.performance.explain.nodeTypes,
      };
    }

    if (metadata.performance.connectionPool) {
      payload.pool = metadata.performance.connectionPool;
    }

    if (metadata.performance.warnings?.length) {
      payload.warnings = metadata.performance.warnings;
    }

    return payload;
  }

  /**
   * Handle slow query logging
   */
  private async handleSlowQuery(
    metadata: CompleteQueryMetadata,
    context: QueryContext,
  ): Promise<void> {
    this.logger?.operational(
      '[Microscope] SLOW query detected',
      this.buildPerfPayload(metadata, context, 'slow', 500),
    );
  }

  /**
   * Handle critical query logging
   */
  private async handleCriticalQuery(
    metadata: CompleteQueryMetadata,
    context: QueryContext,
  ): Promise<void> {
    this.logger?.critical(
      '[Microscope] CRITICAL query performance',
      this.buildPerfPayload(metadata, context, 'critical', 1000),
    );

    // Log full EXPLAIN to separate entry for analysis
    if (metadata.performance.explain) {
      this.logger?.debugTiered('[Microscope] Full execution plan', {
        channel: 'diagnostic',
        correlationId: context.correlationId,
        explain: metadata.performance.explain.plan,
      });
    }
  }

  /**
   * Sanitize SQL for logging (remove sensitive data)
   */
  private sanitizeSQL(sql: string): string {
    // Remove comments
    let sanitized = sql.replace(/--.*$/gm, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Truncate if too long
    if (sanitized.length > 2000) {
      sanitized = sanitized.substring(0, 2000) + '... (truncated)';
    }

    return sanitized;
  }

  /**
   * Sanitize parameters (truncate long values)
   */
  private sanitizeParameters(parameters?: any[]): any[] {
    if (!parameters) return [];

    return parameters.map((param) => {
      if (typeof param === 'string' && param.length > 100) {
        return param.substring(0, 100) + '... (truncated)';
      }
      return param;
    });
  }

  /**
   * Generate unique correlation ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}