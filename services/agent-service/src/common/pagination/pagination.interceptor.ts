import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import {
  PaginationQuerySchema,
  type PaginationQuery,
  type PaginationMeta,
  type NormalizedPagination,
} from '@exprealty/shared-domain'
import { PaginationService } from './pagination.service.js';

export type EnvelopeMode = 'auto' | 'always' | 'never';

export interface PaginationInterceptorOptions {
  /**
   * If true, do not require/compute total.
   * Headers: omit X-Total-Count, but still emit Link for next/prev when deducible.
   * Body meta: total/totalPages may be omitted or set to minimal values.
   */
  countLess?: boolean;

  /**
   * Response envelope behavior.
   * - 'auto' (default): wrap into { data, meta } if handler returned { items, total } or array.
   * - 'always': always wrap.
   * - 'never': never wrap; only set headers.
   */
  envelope?: EnvelopeMode;

  /**
   * Include rel="first"/"last" in Link header (when total known).
   * Defaults to true.
   */
  includeFirstLast?: boolean;

  /**
   * Keys used when wrapping in envelope.
   */
  dataKey?: string; // default 'data'
  metaKey?: string; // default 'meta'
}

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  constructor(
    private readonly pagination: PaginationService,
    @Optional() private readonly opts: PaginationInterceptorOptions = {},
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Parse & normalize query with Zod (coercion + defaults + caps).
    // If invalid (limit > 50, negative, etc.), this will throw 400.
    const normalized: NormalizedPagination = this.parseAndNormalizeQuery(req.query);

    const {
      countLess = false,
      envelope = 'auto',
      includeFirstLast = true,
      dataKey = 'data',
      metaKey = 'meta',
    } = this.opts;

    return next.handle().pipe(
      map((handlerResult: any) => {
        // Extract items/total from common shapes
        const { items, total, shape } = this.extractResult(handlerResult);

        // Validate / compute meta + headers
        if (!countLess) {
          if (typeof total !== 'number' || total < 0) {
            throw new BadRequestException(
              'PaginationInterceptor expected a non-negative numeric "total" from handler result. ' +
                'Return { items: T[]; total: number } or enable countLess mode.',
            );
          }

          // Build meta with accurate total
          const meta: PaginationMeta = this.pagination.buildMeta({
            total,
            offset: normalized.offset,
            limit: normalized.limit,
          });

          // Set headers
          const link = this.pagination.buildLinkHeader(req, meta, { includeFirstLast });
          this.pagination.setPaginationHeaders(res, meta, link);

          // Envelope / pass-through
          if (envelope === 'never') return handlerResult;
          if (envelope === 'always') return { [dataKey]: items ?? handlerResult, [metaKey]: meta };
          // auto
          if (shape === 'items-total') return { [dataKey]: items, [metaKey]: meta };
          if (Array.isArray(handlerResult)) return { [dataKey]: handlerResult, [metaKey]: meta };
          return handlerResult; // unknown shape, don't force-wrap
        }

        // ----------------------------
        // Count-less mode
        // ----------------------------
        const pageLength = Array.isArray(items) ? items.length : Array.isArray(handlerResult) ? handlerResult.length : 0;
        const hasPrev = normalized.offset > 0;
        const hasNext = pageLength >= normalized.limit; // heuristic

        // Minimal "meta" (no total math)
        const metaCountLess = {
          // omit total / totalPages to keep semantics clear
          currentPage: Math.floor(normalized.offset / normalized.limit) + 1,
          limit: normalized.limit,
          offset: normalized.offset,
          hasNext,
          hasPrev,
        };

        // Emit Link: next/prev only (no first/last without total)
        const link = this.buildCountLessLinkHeader(req, normalized, { hasNext, hasPrev });
        if (link) res.setHeader('Link', link);
        res.removeHeader('X-Total-Count');

        if (envelope === 'never') return handlerResult;
        if (envelope === 'always') {
          return { [dataKey]: items ?? handlerResult, [metaKey]: metaCountLess };
        }
        // auto
        if (shape === 'items-total') {
          // Handler returned a total but countLess=true—ignore the total to keep behavior consistent.
          return { [dataKey]: items, [metaKey]: metaCountLess };
        }
        if (Array.isArray(handlerResult)) {
          return { [dataKey]: handlerResult, [metaKey]: metaCountLess };
        }
        return handlerResult;
      }),
    );
  }

  // ---- helpers ----

  private parseAndNormalizeQuery(q: any): NormalizedPagination {
    // Validate with Zod; enforce MAX 50 and defaults.
    const parsed = PaginationQuerySchema.safeParse(q as Partial<PaginationQuery>);
    if (!parsed.success) {
      // Let Zod bubble up a clean 400 shape similar to the ZodValidationPipe.
      const details = parsed.error.issues
        .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      throw new BadRequestException(`Invalid pagination query: ${details}`);
    }
    return this.pagination.normalized(parsed.data);
  }

  private extractResult(result: any): { items: any[] | undefined; total: number | undefined; shape: 'items-total' | 'array' | 'unknown' } {
    if (result && typeof result === 'object' && 'items' in result && 'total' in result) {
      const items = (result as any).items;
      const total = (result as any).total;
      return { items, total, shape: 'items-total' };
    }
    if (Array.isArray(result)) {
      return { items: result, total: undefined, shape: 'array' };
    }
    return { items: undefined, total: undefined, shape: 'unknown' };
  }

  /**
   * Build a limited Link header for count-less mode.
   * Emits rel=next when the page is "full" and rel=prev when offset>0.
   */
  private buildCountLessLinkHeader(
    req: Request,
    normalized: NormalizedPagination,
    flags: { hasNext: boolean; hasPrev: boolean },
  ): string | null {
    const { hasNext, hasPrev } = flags;
    const links: string[] = [];

    const makeUrlWithOffset = (offset: number) => {
      const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
      url.searchParams.set('offset', String(Math.max(0, offset)));
      url.searchParams.set('limit', String(normalized.limit));
      return url.toString();
    };

    if (hasNext) {
      const nextOffset = normalized.offset + normalized.limit;
      links.push(`<${makeUrlWithOffset(nextOffset)}>; rel="next"`);
    }
    if (hasPrev) {
      const prevOffset = Math.max(0, normalized.offset - normalized.limit);
      links.push(`<${makeUrlWithOffset(prevOffset)}>; rel="prev"`);
    }

    return links.length ? links.join(', ') : null;
  }
}
