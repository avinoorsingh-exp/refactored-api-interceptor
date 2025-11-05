import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Lifecycle event type enum.
 *
 * @public
 */
export const LifecycleEventTypeSchema = z
	.enum(['Onboarding', 'Admin Hold'])
	.describe('Lifecycle event type')

/**
 * @public
 */
export type LifecycleEventType = z.infer<typeof LifecycleEventTypeSchema>

/**
 * Base schema for LifecycleEvent entity.
 *
 * @public
 */
export const LifecycleEventBaseSchema = z
	.object({
		id: z.string().uuid(),
		actor: z.string().min(1).max(255),
		effectiveDate: InstantUTC,
		type: LifecycleEventTypeSchema,
		active: z.boolean(),
		noteId: z.string().uuid().optional(),
	})
	.describe('Base LifecycleEvent')

/**
 * @public
 */
export type LifecycleEventBase = z.infer<typeof LifecycleEventBaseSchema>

/**
 * Expanded schema for LifecycleEvent entity with relationships.
 *
 * @public
 */
export const LifecycleEventExpandedSchema = LifecycleEventBaseSchema.extend({
	note: z.lazy(() => z.any()).optional(),
}).describe('Expanded LifecycleEvent with relationships')

/**
 * @public
 */
export type LifecycleEventExpanded = z.infer<typeof LifecycleEventExpandedSchema>

/**
 * @public
 */
export type LifecycleEvent = LifecycleEventExpanded

/**
 * Schema for creating a new LifecycleEvent.
 *
 * @public
 */
export const CreateLifecycleEventInputSchema = LifecycleEventBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateLifecycleEventInput = z.infer<typeof CreateLifecycleEventInputSchema>

/**
 * Schema for updating a LifecycleEvent.
 *
 * @public
 */
export const UpdateLifecycleEventInputSchema = LifecycleEventBaseSchema.omit({
	id: true,
}).partial()

/**
 * @public
 */
export type UpdateLifecycleEventInput = z.infer<typeof UpdateLifecycleEventInputSchema>
