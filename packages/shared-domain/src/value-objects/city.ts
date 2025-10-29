import { z } from 'zod'

/**
 * Branded type for city names.
 *
 * @public
 */
export const CityBranded = z
	.string()
	.min(1, { message: 'City name is required' })
	.max(128, { message: 'City name must not exceed 128 characters' })
	.regex(/^[a-zA-Z\s\-'.]+$/, { message: 'City name contains invalid characters' })
	.brand('City')

/**
 * Type alias for branded city strings.
 *
 * @public
 */
export type City = z.infer<typeof CityBranded>
