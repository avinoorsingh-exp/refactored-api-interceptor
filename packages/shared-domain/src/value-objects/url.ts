import { z } from 'zod'

/**
 * Branded type for URL strings.
 *
 * @public
 */
export const UrlBranded = z
	.string()
	.url({ message: 'Invalid URL format' })
	.max(2048, { message: 'URL must not exceed 2048 characters' })
	.brand('Url')

/**
 * Type alias for branded URL strings.
 *
 * @public
 */
export type Url = z.infer<typeof UrlBranded>
