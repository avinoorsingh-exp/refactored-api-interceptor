import { z } from 'zod'

/**
 * Branded type for phone numbers.
 * Accepts international formats with optional country code.
 *
 * @public
 */
export const PhoneNumberBranded = z
	.string()
	.min(10, { message: 'Phone number must be at least 10 characters' })
	.max(20, { message: 'Phone number must not exceed 20 characters' })
	.regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, {
		message: 'Invalid phone number format',
	})
	.brand('PhoneNumber')

/**
 * Type alias for branded phone number strings.
 *
 * @public
 */
export type PhoneNumber = z.infer<typeof PhoneNumberBranded>
