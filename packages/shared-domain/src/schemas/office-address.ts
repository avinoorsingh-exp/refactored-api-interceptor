import { z } from 'zod'

/**
 * Base schema for OfficeAddress junction entity.
 *
 * @public
 */
export const OfficeAddressBaseSchema = z
	.object({
		officeId: z.string(),
		addressId: z.string().uuid(),
	})
	.describe('Base OfficeAddress')

/**
 * @public
 */
export type OfficeAddressBase = z.infer<typeof OfficeAddressBaseSchema>

/**
 * Expanded schema for OfficeAddress entity with relationships.
 *
 * @public
 */
export const OfficeAddressExpandedSchema = OfficeAddressBaseSchema.extend({
	office: z.lazy(() => z.any()).optional(),
	address: z.lazy(() => z.any()).optional(),
}).describe('Expanded OfficeAddress with relationships')

/**
 * @public
 */
export type OfficeAddressExpanded = z.infer<typeof OfficeAddressExpandedSchema>

/**
 * @public
 */
export type OfficeAddress = OfficeAddressExpanded

/**
 * Schema for creating a new OfficeAddress.
 *
 * @public
 */
export const CreateOfficeAddressInputSchema = OfficeAddressBaseSchema

/**
 * @public
 */
export type CreateOfficeAddressInput = z.infer<typeof CreateOfficeAddressInputSchema>
