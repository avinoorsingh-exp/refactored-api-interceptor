import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * License event type enum.
 *
 * @public
 */
export const LicenseEventTypeSchema = z
	.enum(['Broker Approval', 'License Verification', 'Override', 'Transfer'])
	.describe('License event type')

/**
 * @public
 */
export type LicenseEventType = z.infer<typeof LicenseEventTypeSchema>

/**
 * License event status enum.
 *
 * @public
 */
export const LicenseEventStatusSchema = z
	.enum([
		'Approve',
		'Rejected',
		'Complete',
		'Inactive',
		'Other',
		'Secondary State LOI',
		'Pending',
		'Transferred',
		'Overridden',
	])
	.describe('License event status')

/**
 * @public
 */
export type LicenseEventStatus = z.infer<typeof LicenseEventStatusSchema>

/**
 * Base schema for LicenseEvent entity.
 *
 * @public
 */
export const LicenseEventBaseSchema = z
	.object({
		id: z.string().uuid(),
		licenseId: z.string().uuid(),
		actor: z.string().min(1).max(255),
		date: InstantUTC,
		type: LicenseEventTypeSchema,
		status: LicenseEventStatusSchema,
	})
	.describe('Base LicenseEvent')

/**
 * @public
 */
export type LicenseEventBase = z.infer<typeof LicenseEventBaseSchema>

/**
 * Expanded schema for LicenseEvent entity with relationships.
 *
 * @public
 */
export const LicenseEventExpandedSchema = LicenseEventBaseSchema.extend({
	license: z.lazy(() => z.any()).optional(),
}).describe('Expanded LicenseEvent with relationships')

/**
 * @public
 */
export type LicenseEventExpanded = z.infer<typeof LicenseEventExpandedSchema>

/**
 * @public
 */
export type LicenseEvent = LicenseEventExpanded

/**
 * Schema for creating a new LicenseEvent.
 *
 * @public
 */
export const CreateLicenseEventInputSchema = LicenseEventBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateLicenseEventInput = z.infer<typeof CreateLicenseEventInputSchema>

/**
 * Schema for updating a LicenseEvent.
 *
 * @public
 */
export const UpdateLicenseEventInputSchema = LicenseEventBaseSchema.omit({
	id: true,
}).partial()

/**
 * @public
 */
export type UpdateLicenseEventInput = z.infer<typeof UpdateLicenseEventInputSchema>
