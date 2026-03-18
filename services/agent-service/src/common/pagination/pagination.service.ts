import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import {
    LIMIT_DEFAULT,
    LIMIT_MAX,
    NormalizedPagination,
    NormalizedPaginationSchema,
    PaginationMeta,
    PaginationMetaSchema,
    PaginationQuery,
    PaginationQuerySchema,

} from '@exprealty/shared-domain'


@Injectable()
export class PaginationService {
    normalized(query: Partial<PaginationQuery>): NormalizedPagination {
        const parsed = PaginationQuerySchema.parse(query);
        return NormalizedPaginationSchema.parse(parsed);
    }

    buildMeta(args: {total:number;offset:number;limit:number}): PaginationMeta {
        const {total, offset, limit} = args

        const currentPage = Math.floor(offset / limit) + 1
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const hasPrev = offset > 0;
        const hasNext = offset + limit < total;

        return PaginationMetaSchema.parse({
            total,
            totalPages,
            currentPage,
            limit,
            offset,
            hasNext,
            hasPrev,
        });
    }

    buildLinkHeader(
        req: Request,
        meta: PaginationMeta,
        opts: { includeFirstLast?: boolean} = { includeFirstLast: true },
    ): string | null {
        const { hasNext, hasPrev, totalPages, currentPage, limit } = meta;
        const links: string[] = []

        const makeUrl = (page:number) => {
            // Use forwarded headers from proxy, fallback to direct request values
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const url = new URL(`${protocol}://${host}${req.originalUrl}`);
            // Derive offset from page
            const newOffset = (page - 1) * limit;
            url.searchParams.set('offset', newOffset.toString());
            url.searchParams.set('limit', limit.toString());
            return url.toString();
        }

        if (hasPrev) {
            links.push(`<${makeUrl(currentPage - 1)}>; rel="prev"`);
        }

        if (hasNext) {
            links.push(`<${makeUrl(currentPage + 1)}>; rel="next"`);
        }

        if (opts.includeFirstLast) {
            links.push(`<${makeUrl(1)}>; rel="first"`);
            links.push(`<${makeUrl(totalPages)}>; rel="last"`);
        }

        return links.length > 0 ? links.join(', ') : null;
    }

    setPaginationHeaders(res: Response, meta: PaginationMeta, linkHeader?: string | null) : void {
        res.setHeader("X-Total-Count", meta.total.toString());
        if(linkHeader){
            res.setHeader('Link', linkHeader);
        } else {
            res.removeHeader('Link');
        }
    }

    enforceMaxLimit(limit: number = LIMIT_DEFAULT): number {
        return Math.min(Math.max(1, Math.trunc(limit)), LIMIT_MAX);
    }
}