
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Request } from 'express';

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
  };
}

/**
 * Combined Query + Performance Interceptor
 * 
 * Includes both query metadata AND performance metrics in response
 * 
 * @example
 * ```typescript
 * @UseInterceptors(QueryPerformanceInterceptor)
 * @Get()
 * async findAll(@Query() params: ListingQueryDto) {
 *   return this.listingService.findAll(params);
 * }
 * ```
 * 
 * Response:
 * ```json
 * {
 *   "data": [...],
 *   "meta": {
 *     "total": 1500,
 *     "count": 25,
 *     "query": {
 *       "search": "Dallas",
 *       "filter": { "bedrooms": { "operator": "gte", "value": 3 } },
 *       "sort": "listPrice:DESC",
 *       "pagination": { "offset": 0, "limit": 25 },
 *       "performance": {
 *         "durationMs": 145,
 *         "timestamp": "2024-12-07T10:30:00.000Z"
 *       }
 *     }
 *   }
 * }
 * ```
 */
@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('QueryPerformanceInterceptor');

  constructor(
    private readonly options: {
      slowQueryThresholdMs?: number;
      logAllQueries?: boolean;
    } = {},
  ) {
    this.options.slowQueryThresholdMs = options.slowQueryThresholdMs ?? 2000;
    this.options.logAllQueries = options.logAllQueries ?? false;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const queryParams = request.query;

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
    if (queryParams.sort) {
      try {
        queryMetadata.sort =
          typeof queryParams.sort === 'string'
            ? queryParams.sort.includes('{')
              ? JSON.parse(queryParams.sort)
              : queryParams.sort
            : queryParams.sort;
      } catch {
        queryMetadata.sort = queryParams.sort as any;
      }
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          queryMetadata.performance.durationMs = duration;

          // Add headers
          response.setHeader('X-Response-Time', `${duration}ms`);
          response.setHeader('X-Query-Timestamp', timestamp);

          // Log slow queries
          if (duration >= this.options.slowQueryThresholdMs!) {
            this.logger.warn('Slow query detected', {
              endpoint: `${request.method} ${request.url}`,
              duration,
              threshold: this.options.slowQueryThresholdMs,
              query: queryMetadata,
            });
          } else if (this.options.logAllQueries) {
            this.logger.debug('Query completed', {
              endpoint: `${request.method} ${request.url}`,
              duration,
              query: queryMetadata,
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          queryMetadata.performance.durationMs = duration;

          response.setHeader('X-Response-Time', `${duration}ms`);
          response.setHeader('X-Query-Timestamp', timestamp);

          this.logger.error('Query failed', {
            endpoint: `${request.method} ${request.url}`,
            duration,
            error: error.message,
            query: queryMetadata,
          });
        },
      }),
      map((data) => {
        // Update performance duration
        queryMetadata.performance.durationMs = Date.now() - startTime;

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

        // Wrap array responses
        if (Array.isArray(data)) {
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
}