import { z } from 'zod'


/**
* Cursor-based paging request.
* @public
*/
export const PageRequest = z.object({
cursor: z.string().optional(),
limit: z.number().int().min(1).max(100).default(25),
})
export type PageRequest = z.infer<typeof PageRequest>


/**
* Paging metadata returned with list/search responses.
* @public
*/
export const PageMeta = z.object({
nextCursor: z.string().optional(),
/** Number of items returned in this page. */
count: z.number().int().nonnegative(),
})
export type PageMeta = z.infer<typeof PageMeta>


/**
* Factory to build a page response schema for an array of T.
* @internal
*/
export const pageOf = <T extends z.ZodTypeAny>(item: T) => z.object({
items: z.array(item),
meta: PageMeta,
})