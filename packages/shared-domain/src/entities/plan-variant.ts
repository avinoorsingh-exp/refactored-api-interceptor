import { z } from 'zod'

/**
 * Base schema for PlanVariant entity.
 *
 * @public
 */
export const PlanVariantBaseSchema = z
	.object({
		id: z.string().uuid(),
		paymentSettings: z.string().uuid(),
		name: z.string().max(255),
		defaultValue: z.number(), // decimal
		isDefault: z.boolean(),
		lastModified: z.string().datetime(),
	})
	.describe('Base PlanVariant')

/**
 * @public
 */
export type PlanVariantBase = z.infer<typeof PlanVariantBaseSchema>

/**
 * @public
 */
export type PlanVariant = PlanVariantBase
