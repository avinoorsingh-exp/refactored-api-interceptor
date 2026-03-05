import { z } from 'zod'

/**
 * Base schema for AgentOffice junction table.
 *
 * @public
 */
export const AgentOfficeBaseSchema = z
	.object({
		id: z.string().uuid(),
		isPrimary: z.boolean(),
		agentId: z.string().uuid(),
		officeId: z.string().uuid(),
	})
	.describe('Base AgentOffice for joins')

/**
 * Expanded schema for AgentOffice.
 *
 * @public
 */
export const AgentOfficeExpandedSchema = AgentOfficeBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(), // AgentBaseSchema
	office: z.lazy(() => z.any()).optional(), // OfficeBaseSchema
}).describe('Expanded AgentOffice with relationships')

/**
 * @public
 */
export type AgentOfficeBase = z.infer<typeof AgentOfficeBaseSchema>

/**
 * @public
 */
export type AgentOfficeExpanded = z.infer<typeof AgentOfficeExpandedSchema>

/**
 * @public
 */
export type AgentOffice = AgentOfficeExpanded
