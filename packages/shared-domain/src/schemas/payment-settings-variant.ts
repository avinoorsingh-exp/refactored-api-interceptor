import { z } from 'zod'

/**
 * Payment Settings Variant type.
 * @public
 */
export const PaymentSettingsVariantType = z
	.enum(['concession', 'fees'])
	.describe('Payment settings variant type')

/**
 * Base schema for PaymentSettingsVariant entity.
 *
 * @public
 */
export const PaymentSettingsVariantBaseSchema = z
	.object({
		id: z.string().uuid(),
		paymentSettings: z.string().uuid(),
		customName: z.string().max(255),
		value: z.number(), // decimal
		startDate: z.string().datetime(),
		endDate: z.string().datetime(),
		type: PaymentSettingsVariantType,
		lastModified: z.string().datetime(),
	})
	.describe('Base PaymentSettingsVariant')

/**
 * Expanded schema for PaymentSettingsVariant.
 *
 * @public
 */
export const PaymentSettingsVariantExpandedSchema =
	PaymentSettingsVariantBaseSchema.extend({
		paymentSettingsEntity: z.lazy(() => z.any()).optional(),
	}).describe('Expanded PaymentSettingsVariant with relationships')

/**
 * @public
 */
export type PaymentSettingsVariantBase = z.infer<typeof PaymentSettingsVariantBaseSchema>

/**
 * @public
 */
export type PaymentSettingsVariantExpanded = z.infer<
	typeof PaymentSettingsVariantExpandedSchema
>

/**
 * @public
 */
export type PaymentSettingsVariant = PaymentSettingsVariantExpanded
