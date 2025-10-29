import { z } from 'zod'

/**
 * Zod schema for hashed values (SHA-256, bcrypt, etc.).
 * Ensures a non-empty trimmed string up to 200 characters.
 * @public
 */
export const HashBranded = z
	.string({ message: 'errors.shared.hash.required' })
	.trim()
	.min(1, { message: 'errors.shared.hash.required' })
	.max(200, { message: 'errors.shared.hash.length' })
	.regex(/^[A-Za-z0-9+/=.$_-]+$/, {
		message: 'errors.shared.hash.invalidFormat',
	})
	.brand<'Hash'>()
	.describe('Hashed value (≤ 200 chars; base64/hex/bcrypt-safe)')

/**
 * TypeScript type for a hashed value.
 * @public
 */
export type Hash = z.infer<typeof HashBranded>
