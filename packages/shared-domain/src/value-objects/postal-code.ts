import { z } from 'zod'

/**
 * Branded type for postal codes.
 * Validates format but allows international formats.
 *
 * @public
 */
export const PostalCodeBranded = z
	.string()
	.min(3, { message: 'Postal code must be at least 3 characters' })
	.max(16, { message: 'Postal code must not exceed 16 characters' })
	.regex(/^[A-Z0-9\s-]+$/i, { message: 'Postal code contains invalid characters' })
	.brand('PostalCode')

/**
 * Type alias for branded postal code strings.
 *
 * @public
 */
export type PostalCode = z.infer<typeof PostalCodeBranded>
