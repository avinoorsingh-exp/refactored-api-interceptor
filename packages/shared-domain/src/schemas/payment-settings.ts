import { z } from 'zod'

/**
 * Base schema for PaymentSettings entity.
 *
 * @public
 */
export const PaymentSettingsBaseSchema = z
	.object({
		id: z.string().uuid(),
		agentId: z.string().uuid(),
		capResetDate: z.string().datetime(),
		splitCheck: z.boolean(),
		capResetDateChangedByUser: z.boolean(),
	})
	.describe('Base PaymentSettings')

/**
 * Expanded schema for PaymentSettings.
 *
 * @public
 */
export const PaymentSettingsExpandedSchema = PaymentSettingsBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(), // AgentBaseSchema
	paymentSettingsVariants: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded PaymentSettings with relationships')

/**
 * @public
 */
export type PaymentSettingsBase = z.infer<typeof PaymentSettingsBaseSchema>

/**
 * @public
 */
export type PaymentSettingsExpanded = z.infer<typeof PaymentSettingsExpandedSchema>

/**
 * @public
 */
export type PaymentSettings = PaymentSettingsExpanded
