import { z } from 'zod'
import { UrlBranded } from '../value-objects/index.js'

/**
 * Office lifecycle status.
 * @public
 */
export const OfficeLifecycleStatus = z
	.enum([
		'new',
		'pending',
		'due_diligence',
		'pending_payment',
		'active',
		'withdrawn',
		'missing_broker_agent',
	])
	.describe('Office lifecycle status')

/**
 * Base schema for Office entity.
 * Used for list views and minimal data fetching.
 *
 * @public
 */
export const OfficeBaseSchema = z
	.object({
		id: z.string().uuid(),
		officeId: z.bigint(),
		website: UrlBranded.nullable(),
		name: z.string().max(255),
		phone: z.string().max(20),
		lifecycleStatus: OfficeLifecycleStatus,
		primaryState: z.string().max(200),
	})
	.describe('Base Office for list views')

/**
 * Expanded schema for Office entity.
 * Includes relationships for detail views.
 *
 * @public
 */
export const OfficeExpandedSchema = OfficeBaseSchema.extend({
	agentOffices: z.lazy(() => z.array(z.any())).optional(), // AgentOfficeBaseSchema[]
	officeExternalReferences: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Office with relationships')

/**
 * @public
 */
export type OfficeBase = z.infer<typeof OfficeBaseSchema>

/**
 * @public
 */
export type OfficeExpanded = z.infer<typeof OfficeExpandedSchema>

/**
 * @public
 */
export type Office = OfficeExpanded
