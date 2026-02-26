import { z } from 'zod'

export const LIMIT_DEFAULT = 25 as const;
export const LIMIT_MAX = 50 as const;

/**
 * Clamps a limit value to the valid range [1, LIMIT_MAX].
 * Values < 1 are clamped to LIMIT_DEFAULT.
 * Values > LIMIT_MAX are clamped to LIMIT_MAX.
 */
const clampLimit = (val: number): number =>
	val < 1 ? LIMIT_DEFAULT : val > LIMIT_MAX ? LIMIT_MAX : val

export const PaginationQuerySchema = z.object({
    offset: z.coerce.number().int().min(0).optional().default(0),
    limit: z.coerce
        .number()
        .int()
        .optional()
        .default(LIMIT_DEFAULT)
        .transform(clampLimit),
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