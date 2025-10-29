import { z } from 'zod'

/**
 * Base schema for PayPlan entity.
 *
 * @public
 */
export const PayPlanBaseSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().max(255),
		active: z.boolean(),
		agentPercentage: z.number(), // decimal
		cap: z.number(), // decimal
	})
	.describe('Base PayPlan')

/**
 * Expanded schema for PayPlan.
 *
 * @public
 */
export const PayPlanExpandedSchema = PayPlanBaseSchema.extend({
	payPlanVariants: z.lazy(() => z.array(z.any())).optional(),
	paymentSettings: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded PayPlan with relationships')

/**
 * @public
 */
export type PayPlanBase = z.infer<typeof PayPlanBaseSchema>

/**
 * @public
 */
export type PayPlanExpanded = z.infer<typeof PayPlanExpandedSchema>

/**
 * @public
 */
export type PayPlan = PayPlanExpanded
