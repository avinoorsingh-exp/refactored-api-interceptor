// services/agent-service/src/common/performance.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../core/logger.service.js';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('PerformanceInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    return next.handle().pipe(
      tap({
        next: (data: unknown) => {
          const duration = Date.now() - startTime;
          const endMemory = process.memoryUsage();
          const memoryDelta = {
            rss: Math.round((endMemory.rss - startMemory.rss) / 1024 / 1024),
            heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024),
          };

          // Log slow queries (> 1 second)
          if (duration > 1000) {
            const responseData = data as Record<string, unknown> | null;
            this.logger.warn('Slow request detected', {
              method,
              url,
              duration_ms: duration,
              memory_delta_mb: memoryDelta,
              result_count: Array.isArray(responseData?.items) ? responseData.items.length : null,
              total: responseData?.total,
            });
          }

          // Add performance metadata to response if it's an object
          if (data && typeof data === 'object') {
            const responseData = data as Record<string, unknown>;
            responseData.meta = {
              ...(responseData.meta as Record<string, unknown>),
              duration_ms: duration,
              memory_delta_mb: memoryDelta,
            };
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error('Request failed', {
            method,
            url,
            duration_ms: duration,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }
}