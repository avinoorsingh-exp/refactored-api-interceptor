import { z } from 'zod'

/**
 * Base schema for AgentLanguage junction table.
 *
 * @public
 */
export const AgentLanguageBaseSchema = z
	.object({
		agentId: z.string().uuid(),
		languageId: z.string().uuid(),
	})
	.describe('Base AgentLanguage junction')

/**
 * @public
 */
export type AgentLanguageBase = z.infer<typeof AgentLanguageBaseSchema>

/**
 * Expanded schema for AgentLanguage with relationships.
 *
 * @public
 */
export const AgentLanguageExpandedSchema = AgentLanguageBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(),
	language: z.lazy(() => z.any()).optional(),
}).describe('Expanded AgentLanguage with relationships')

/**
 * @public
 */
export type AgentLanguageExpanded = z.infer<typeof AgentLanguageExpandedSchema>

/**
 * @public
 */
export type AgentLanguage = AgentLanguageExpanded

/**
 * Schema for creating a new AgentLanguage.
 *
 * @public
 */
export const CreateAgentLanguageInputSchema = AgentLanguageBaseSchema

/**
 * @public
 */
export type CreateAgentLanguageInput = z.infer<typeof CreateAgentLanguageInputSchema>

/**
 * Schema for updating an AgentLanguage.
 *
 * @public
 */
export const UpdateAgentLanguageInputSchema = AgentLanguageBaseSchema.partial()

/**
 * @public
 */
export type UpdateAgentLanguageInput = z.infer<typeof UpdateAgentLanguageInputSchema>
