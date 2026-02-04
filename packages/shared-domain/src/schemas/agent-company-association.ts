import { z } from 'zod'

/**
 * Base schema for AgentCompanyAssociation junction table.
 * Represents the many-to-many relationship between Agent and AgentCompany.
 *
 * @public
 */
export const AgentCompanyAssociationBaseSchema = z
	.object({
		id: z.string().uuid(),
		agentId: z.string().uuid(),
		agentCompanyId: z.string().uuid(),
		isPrimary: z.boolean(),
	})
	.describe('Base AgentCompanyAssociation for joins')

/**
 * Expanded schema for AgentCompanyAssociation.
 * Includes nested agent and agent company relationships.
 *
 * @public
 */
export const AgentCompanyAssociationExpandedSchema = AgentCompanyAssociationBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(), // AgentBaseSchema
	agentCompany: z.lazy(() => z.any()).optional(), // AgentCompanyBaseSchema
}).describe('Expanded AgentCompanyAssociation with relationships')

/**
 * Type for base agent company association data.
 * @public
 */
export type AgentCompanyAssociationBase = z.infer<typeof AgentCompanyAssociationBaseSchema>

/**
 * Type for expanded agent company association data with relationships.
 * @public
 */
export type AgentCompanyAssociationExpanded = z.infer<typeof AgentCompanyAssociationExpandedSchema>

/**
 * Default type for agent company association.
 * @public
 */
export type AgentCompanyAssociation = AgentCompanyAssociationExpanded

/**
 * Schema for creating a new agent company association.
 * Used when assigning an agent to a company.
 *
 * @public
 */
export const CreateAgentCompanyAssociationSchema = z
	.object({
		agentCompanyId: z.string().uuid({ message: 'errors.agent_company_association.agent_company_id.invalid' }),
		isPrimary: z.boolean().default(false),
	})
	.describe('Payload to create an agent company association')

/**
 * Type for creating an agent company association.
 * @public
 */
export type CreateAgentCompanyAssociationInput = z.infer<typeof CreateAgentCompanyAssociationSchema>

/**
 * Schema for updating an agent company association.
 * Only isPrimary can be updated (changing company requires delete + create).
 *
 * @public
 */
export const UpdateAgentCompanyAssociationSchema = z
	.object({
		isPrimary: z.boolean(),
	})
	.describe('Payload to update an agent company association')

/**
 * Type for updating an agent company association.
 * @public
 */
export type UpdateAgentCompanyAssociationInput = z.infer<typeof UpdateAgentCompanyAssociationSchema>

/**
 * Schema for the ID parameter in root routes (/v1/agent-companies/:id).
 * @public
 */
export const AgentCompanyAssociationIdParamSchema = z.object({
	id: z.string().uuid({ message: 'errors.agent_company_association.id.invalid' }),
})

/**
 * Type for the ID parameter.
 * @public
 */
export type AgentCompanyAssociationIdParam = z.infer<typeof AgentCompanyAssociationIdParamSchema>
