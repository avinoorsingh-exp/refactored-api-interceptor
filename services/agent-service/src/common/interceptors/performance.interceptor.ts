
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Performance metadata
 */
export interface PerformanceMetadata {
  durationMs: number;
  timestamp: string;
  endpoint: string;
  method: string;
  statusCode?: number;
}

/**
 * Performance Interceptor
 * 
 * Tracks request execution time and logs slow queries
 * Adds performance metadata to response headers
 * 
 * Features:
 * - Measures total request duration
 * - Logs slow queries (configurable threshold)
 * - Adds X-Response-Time header
 * - Adds X-Query-Timestamp header
 * - Optionally includes performance in response body
 * 
 * @example
 * ```typescript
 * @UseInterceptors(new PerformanceInterceptor({ slowQueryThresholdMs: 1000 }))
 * @Get()
 * async findAll() {
 *   // Long-running query
 * }
 * ```
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('PerformanceInterceptor');

  constructor(
    private readonly options: {
      /**
       * Threshold in ms to log as slow query
       * Default: 2000ms (2 seconds)
       */
      slowQueryThresholdMs?: number;

      /**
       * Include performance metadata in response body
       * Default: false (only in headers)
       */
      includeInBody?: boolean;

      /**
       * Log all queries (not just slow ones)
       * Default: false
       */
      logAllQueries?: boolean;
    } = {},
  ) {
    this.options.slowQueryThresholdMs = options.slowQueryThresholdMs ?? 2000;
    this.options.includeInBody = options.includeInBody ?? false;
    this.options.logAllQueries = options.logAllQueries ?? false;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    const performanceMetadata: PerformanceMetadata = {
      durationMs: 0,
      timestamp,
      endpoint: `${request.method} ${request.url}`,
      method: request.method,
    };

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          performanceMetadata.durationMs = duration;
          performanceMetadata.statusCode = response.statusCode;

          // Add performance headers
          response.setHeader('X-Response-Time', `${duration}ms`);
          response.setHeader('X-Query-Timestamp', timestamp);

          // Log slow queries
          if (duration >= this.options.slowQueryThresholdMs!) {
            this.logger.warn('Slow query detected', {
              ...performanceMetadata,
              queryParams: request.query,
              warning: `Query took ${duration}ms (threshold: ${this.options.slowQueryThresholdMs}ms)`,
            });
          } else if (this.options.logAllQueries) {
            this.logger.debug('Query completed', {
              ...performanceMetadata,
              queryParams: request.query,
            });
          }

          // Optionally include in response body
          if (this.options.includeInBody && data && typeof data === 'object') {
            if ('meta' in data) {
              data.meta = {
                ...data.meta,
                performance: {
                  durationMs: duration,
                  timestamp,
                },
              };
            } else {
              data.performance = {
                durationMs: duration,
                timestamp,
              };
            }
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          performanceMetadata.durationMs = duration;
          performanceMetadata.statusCode = error.status || 500;

          // Add headers even for errors
          response.setHeader('X-Response-Time', `${duration}ms`);
          response.setHeader('X-Query-Timestamp', timestamp);

          // Log error with performance data
          this.logger.error('Query failed', {
            ...performanceMetadata,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }
}