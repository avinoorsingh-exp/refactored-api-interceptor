import { z } from 'zod'

/**
 * Zod schema for ISO 8601 date strings (YYYY-MM-DD format).
 * @public
 */
export const DateOnlyISO = z
	.string({ message: 'errors.shared.date.required' })
	.regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'errors.shared.date.iso' })
	.brand<'DateOnlyISO'>()

/**
 * TypeScript type for ISO date strings.
 * @public
 */
export type DateOnlyISO = z.infer<typeof DateOnlyISO>

/**
 * Zod schema for UTC timestamps as JavaScript Date objects.
 * Serializes to ISO format with 'Z' suffix.
 * @public
 */
export const InstantUTC = z
	.date({ message: 'errors.shared.instant.invalid' })
	.brand<'InstantUTC'>()

/**
 * TypeScript type for UTC instant timestamps.
 * @public
 */
export type InstantUTC = z.infer<typeof InstantUTC>
