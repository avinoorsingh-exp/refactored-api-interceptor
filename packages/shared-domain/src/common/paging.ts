import { off } from 'process';
import { z } from 'zod'

export const LIMIT_DEFAULT = 25 as const;
export const LIMIT_MAX = 50 as const;

export const PaginationQuerySchema = z.object({
    offset: z.coerce.number().int().min(0).optional().default(0),
    limit: z.coerce.number().int().min(1).max(LIMIT_MAX).optional().default(LIMIT_DEFAULT),
})

export const NormalizedPaginationSchema = z.object({
	offset: z.number().int().min(0),
	limit: z.number().int().min(1).max(LIMIT_MAX),
})

export type NormalizedPagination = z.infer<typeof NormalizedPaginationSchema>

export const PaginationMetaSchema = z.object({
	total: z.number().int().min(0),
	totalPages: z.number().int().min(0),
	currentPage: z.number().int().min(1),
	limit: z.number().int().min(1).max(LIMIT_MAX),
	offset: z.number().int().min(0),
	hasNext: z.boolean(),
	hasPrev: z.boolean(),
})

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>