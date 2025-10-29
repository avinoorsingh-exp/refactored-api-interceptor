import { z } from 'zod'

/**
 * Base schema for AgentSpecialty junction table.
 *
 * @public
 */
export const AgentSpecialtyBaseSchema = z
	.object({
		agentUuid: z.string().uuid(),
		publicProfileId: z.string().uuid(),
		specialtyId: z.string(),
	})
	.describe('Base AgentSpecialty junction')

/**
 * @public
 */
export type AgentSpecialtyBase = z.infer<typeof AgentSpecialtyBaseSchema>

/**
 * Expanded schema for AgentSpecialty with relationships.
 *
 * @public
 */
export const AgentSpecialtyExpandedSchema = AgentSpecialtyBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(),
	publicProfile: z.lazy(() => z.any()).optional(),
	specialty: z.lazy(() => z.any()).optional(),
}).describe('Expanded AgentSpecialty with relationships')

/**
 * @public
 */
export type AgentSpecialtyExpanded = z.infer<typeof AgentSpecialtyExpandedSchema>

/**
 * @public
 */
export type AgentSpecialty = AgentSpecialtyExpanded

/**
 * Schema for creating a new AgentSpecialty.
 *
 * @public
 */
export const CreateAgentSpecialtyInputSchema = AgentSpecialtyBaseSchema

/**
 * @public
 */
export type CreateAgentSpecialtyInput = z.infer<typeof CreateAgentSpecialtyInputSchema>

/**
 * Schema for updating an AgentSpecialty.
 *
 * @public
 */
export const UpdateAgentSpecialtyInputSchema = AgentSpecialtyBaseSchema.partial()

/**
 * @public
 */
export type UpdateAgentSpecialtyInput = z.infer<typeof UpdateAgentSpecialtyInputSchema>
