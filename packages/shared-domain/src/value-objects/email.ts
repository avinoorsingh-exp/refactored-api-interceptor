import { z } from 'zod'

/**
 * Zod schema for validated email addresses.
 * @public
 */
export const EmailBranded = z.string().email().brand<'Email'>()

/**
 * TypeScript type for a validated email.
 * @public
 */
export type Email = z.infer<typeof EmailBranded>
