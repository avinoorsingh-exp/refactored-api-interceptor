import { z } from 'zod'


/**
* Canonical app-level error codes.
* @public
*/
export enum ErrorCode {
VALIDATION_FAILED = 'VALIDATION_FAILED',
NOT_FOUND = 'NOT_FOUND',
RATE_LIMITED = 'RATE_LIMITED',
UNAUTHORIZED = 'UNAUTHORIZED',
FORBIDDEN = 'FORBIDDEN',
INTERNAL = 'INTERNAL',
}


/**
* RFC7807 Problem Details shape (minimal, stable subset).
* @public
*/
export const ProblemDetails = z.object({
type: z.string().url().optional(),
title: z.string(),
status: z.number().int(),
detail: z.string().optional(),
instance: z.string().optional(),
code: z.nativeEnum(ErrorCode).optional(),
/** Additional, vendor-neutral fields (namespaced if needed) */
extensions: z.record(z.unknown()).optional(),
})
export type ProblemDetails = z.infer<typeof ProblemDetails>


/**
* Helper to create a ProblemDetails object.
* @internal
*/
export function makeProblem(input: ProblemDetails): ProblemDetails {
return input
}