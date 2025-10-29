import { z } from 'zod'

/**
 * Base schema for W9Address junction entity.
 *
 * @public
 */
export const W9AddressBaseSchema = z
	.object({
		w9Id: z.string().uuid(),
		addressId: z.string().uuid(),
	})
	.describe('Base W9Address')

/**
 * @public
 */
export type W9AddressBase = z.infer<typeof W9AddressBaseSchema>

/**
 * Expanded schema for W9Address entity with relationships.
 *
 * @public
 */
export const W9AddressExpandedSchema = W9AddressBaseSchema.extend({
	w9: z.lazy(() => z.any()).optional(),
	address: z.lazy(() => z.any()).optional(),
}).describe('Expanded W9Address with relationships')

/**
 * @public
 */
export type W9AddressExpanded = z.infer<typeof W9AddressExpandedSchema>

/**
 * @public
 */
export type W9Address = W9AddressExpanded

/**
 * Schema for creating a new W9Address.
 *
 * @public
 */
export const CreateW9AddressInputSchema = W9AddressBaseSchema

/**
 * @public
 */
export type CreateW9AddressInput = z.infer<typeof CreateW9AddressInputSchema>
