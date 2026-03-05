import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'
import { EmailBranded } from '../value-objects/email.js'

/**
 * Base schema for State entity.
 *
 * @public
 */
export const StateBaseSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(255),
		code: z.string().max(10),
		isActive: z.boolean(),
		email: EmailBranded.optional(),
		signatureDistributionEmail: EmailBranded.optional(),
		lastModified: InstantUTC,
		modifiedBy: z.string().max(255),
		regionId: z.string(),
	})
	.describe('Base State')

/**
 * @public
 */
export type StateBase = z.infer<typeof StateBaseSchema>

/**
 * Expanded schema for State entity with relationships.
 *
 * @public
 */
export const StateExpandedSchema = StateBaseSchema.extend({
	region: z.lazy(() => z.any()).optional(),
	statePrograms: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded State with relationships')

/**
 * @public
 */
export type StateExpanded = z.infer<typeof StateExpandedSchema>

/**
 * @public
 */
export type State = StateExpanded

/**
 * Schema for creating a new State.
 *
 * @public
 */
export const CreateStateInputSchema = StateBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateStateInput = z.infer<typeof CreateStateInputSchema>

/**
 * Schema for updating a State.
 *
 * @public
 */
export const UpdateStateInputSchema = StateBaseSchema.omit({ id: true }).partial()

/**
 * @public
 */
export type UpdateStateInput = z.infer<typeof UpdateStateInputSchema>
