import { z } from 'zod'

/**
 * Base schema for AgentMLS junction table.
 *
 * @public
 */
export const AgentMLSBaseSchema = z
	.object({
		agentId: z.string(),
		mlsId: z.string(),
	})
	.describe('Base AgentMLS junction')

/**
 * @public
 */
export type AgentMLSBase = z.infer<typeof AgentMLSBaseSchema>

/**
 * Expanded schema for AgentMLS with relationships.
 *
 * @public
 */
export const AgentMLSExpandedSchema = AgentMLSBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(),
}).describe('Expanded AgentMLS with relationships')

/**
 * @public
 */
export type AgentMLSExpanded = z.infer<typeof AgentMLSExpandedSchema>

/**
 * @public
 */
export type AgentMLS = AgentMLSExpanded

/**
 * Schema for creating a new AgentMLS.
 *
 * @public
 */
export const CreateAgentMLSInputSchema = AgentMLSBaseSchema

/**
 * @public
 */
export type CreateAgentMLSInput = z.infer<typeof CreateAgentMLSInputSchema>

/**
 * Schema for updating an AgentMLS.
 *
 * @public
 */
export const UpdateAgentMLSInputSchema = AgentMLSBaseSchema.partial()

/**
 * @public
 */
export type UpdateAgentMLSInput = z.infer<typeof UpdateAgentMLSInputSchema>
