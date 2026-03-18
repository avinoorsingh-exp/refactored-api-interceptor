
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Query metadata that will be included in responses
 */
export interface QueryMetadata {
  search?: string;
  filter?: Record<string, any>;
  sort?: string | any[];
  pagination: {
    offset: number;
    limit: number;
    page?: number;
    pageSize?: number;
  };
  appliedAt: string;
}

/**
 * Response wrapper with query metadata
 */
export interface QueryMetadataResponse<T> {
  data: T;
  meta: {
    total?: number;
    count?: number;
    query: QueryMetadata;
  };
}

/**
 * Query Metadata Interceptor
 * 
 * Includes the applied query parameters in the response
 * Useful for debugging and API transparency
 * 
 * @example
 * ```typescript
 * @UseInterceptors(QueryMetadataInterceptor)
 * @Get()
 * async findAll(@Query() params: ListingQueryDto) {
 *   return this.listingService.findAll(params);
 * }
 */
@Injectable()
export class QueryMetadataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const queryParams = request.query;

    // Build query metadata from request
    const queryMetadata: QueryMetadata = {
      pagination: {
        offset: parseInt(queryParams.offset as string) || 0,
        limit: parseInt(queryParams.limit as string) || 25,
        page: queryParams.page ? parseInt(queryParams.page as string) : undefined,
        pageSize: queryParams.pageSize ? parseInt(queryParams.pageSize as string) : undefined,
      },
      appliedAt: new Date().toISOString(),
    };

    // Include search if present
    if (queryParams.search) {
      queryMetadata.search = queryParams.search as string;
    }

    // Include filter if present
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

    // Include sort if present
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
      map((data) => {
        // If response already has meta (from service), merge it
        if (data && typeof data === 'object' && 'meta' in data) {
          return {
            ...data,
            meta: {
              ...data.meta,
              query: queryMetadata,
            },
          };
        }

        // If response has items/total pattern (from repository)
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

        // Wrap simple array responses
        if (Array.isArray(data)) {
          return {
            data,
            meta: {
              count: data.length,
              query: queryMetadata,
            },
          };
        }

        return data;
      }),
    );
  }
}