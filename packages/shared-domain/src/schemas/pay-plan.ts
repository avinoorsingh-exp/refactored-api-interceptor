import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { trimmedStringMinMax } from './base-schemas.js'

/**
 * Base schema for PayPlan entity.
 *
 * @public
 */
export const PayPlanBaseSchema = z
	.object({
		id: z.string().uuid(),
		name: trimmedStringMinMax(1, 255, 'Pay plan name must be between 1 and 255 characters'),
		active: z.boolean(),
		agentPercentage: z.number(), // decimal(18,8) - accepts any numeric value
		cap: z.number(), // decimal(18,8) - accepts any numeric value
	})
	.merge(AuditableSchema)
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

/**
 * Schema for creating a new PayPlan.
 * Omits auto-generated fields (id, created, lastModified, modifiedBy).
 * @public
 */
export const CreatePayPlanInputSchema = PayPlanBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	mxid: true,
})

/**
 * @public
 */
export type CreatePayPlanInput = z.infer<typeof CreatePayPlanInputSchema>

/**
 * Schema for updating a PayPlan.
 * All fields are optional for partial updates.
 * Omits auto-generated fields.
 * @public
 */
export const UpdatePayPlanInputSchema = PayPlanBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	mxid: true,
}).partial()

/**
 * @public
 */
export type UpdatePayPlanInput = z.infer<typeof UpdatePayPlanInputSchema>

/**
 * Schema for PayPlan ID path parameter validation.
 * @public
 */
export const PayPlanIdParamSchema = z.object({
	id: PayPlanBaseSchema.shape.id,
})

/**
 * @public
 */
export type PayPlanIdParam = z.infer<typeof PayPlanIdParamSchema>
