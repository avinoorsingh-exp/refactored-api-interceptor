// packages/model/src/value-objects/name.ts
import { z } from 'zod'
import { NAME } from './contraints.js'

/**
 * Zod schema for validated name strings (2-50 characters).
 * @public
 */
export const NameBranded = z
	.string({ message: 'errors.shared.name.required' })
	.trim()
	.min(NAME.min, { message: 'errors.shared.name.min' })
	.max(NAME.max, { message: 'errors.shared.name.max' })
	.brand<'Name'>()

/**
 * TypeScript type for a validated name.
 * @public
 */
export type Name = z.infer<typeof NameBranded>
