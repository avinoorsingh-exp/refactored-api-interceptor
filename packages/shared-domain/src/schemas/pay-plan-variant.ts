import { z } from 'zod'

/**
 * Base schema for PayPlanVariant entity.
 *
 * @public
 */
export const PayPlanVariantBaseSchema = z
	.object({
		variantId: z.string(),
		payPlanId: z.string(),
		value: z.number(), // decimal
	})
	.describe('Base PayPlanVariant')

/**
 * @public
 */
export type PayPlanVariantBase = z.infer<typeof PayPlanVariantBaseSchema>

/**
 * @public
 */
export type PayPlanVariant = PayPlanVariantBase
