import { z } from 'zod'
import {
	EmailBranded,
	InstantUTC,
	NameBranded,
	PhoneNumberBranded,
} from '../value-objects/index.js'

/**
 * Base schema for AgentCompany entity.
 * Used for list views and minimal data fetching for performance.
 * Contains only essential fields without relationships.
 *
 * @public
 */
export const AgentCompanyBaseSchema = z
	.object({
		id: z.string().uuid({ message: 'errors.company.id.invalid' }),
		legacyId: z.string().regex(/^\d+$/, { message: 'errors.company.legacy.id.invalid' }),
		email: EmailBranded,
		name: NameBranded,
		phone: PhoneNumberBranded,
		useSsn: z.boolean(),
		createdAt: InstantUTC,
		updatedAt: InstantUTC,
	})
	.describe('Base AgentCompany for list views')

/**
 * Expanded schema for AgentCompany entity.
 * Includes all fields and relationships for detail views.
 * Use this when you need the complete object graph.
 *
 * @public
 */
export const AgentCompanyExpandedSchema = AgentCompanyBaseSchema.extend({
	taxId: z.string().max(50).nullable().describe('Masked tax ID for display (e.g., "*****6789")'),
	// Intentionally included in the API response: callers use this non-reversible
	// HMAC token for client-side deduplication checks without exposing the full tax ID.
	// Do not remove — see ADR-PII-001 §7.
	taxIdToken: z.string().nullable().describe('HMAC-SHA256 token for secure lookups'),
	// Relationships loaded in expanded view
	agents: z.lazy(() => z.array(z.any())).optional(), // AgentBaseSchema[]
}).describe('Expanded AgentCompany with relationships')

/**
 * Type for base agent company data.
 *
 * @public
 */
export type AgentCompanyBase = z.infer<typeof AgentCompanyBaseSchema>

/**
 * Type for expanded agent company data with relationships.
 *
 * @public
 */
export type AgentCompanyExpanded = z.infer<typeof AgentCompanyExpandedSchema>

/**
 * Default type for agent company (use expanded).
 *
 * @public
 */
export type AgentCompany = AgentCompanyExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use AgentCompanyExpandedSchema instead
 * @public
 */
export const AgentCompanySchema = AgentCompanyExpandedSchema

/**
 * Zod schema for creating a new agent company.
 * @public
 */
export const CreateAgentCompanyInput = AgentCompanyBaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})
	.extend({
		name: z.string().trim().pipe(NameBranded),
		phone: z.string().trim().pipe(PhoneNumberBranded),
		taxId: z.string().trim().min(1).max(50).optional().nullable(),
	})
	.describe('Payload to create a company')

/**
 * TypeScript type for agent company creation payload.
 * @public
 */
export type CreateAgentCompanyInput = z.infer<typeof CreateAgentCompanyInput>

/**
 * Zod schema for updating an agent company.
 * @public
 */
export const UpdateAgentCompanyInput = CreateAgentCompanyInput.partial().describe(
	'Partial update payload for a company',
)

/**
 * TypeScript type for agent company update payload.
 * @public
 */
export type UpdateAgentCompanyInput = z.infer<typeof UpdateAgentCompanyInput>

/**
 * Schema for the ID parameter in routes (/v1/agent-companies/:id).
 * @public
 */
export const AgentCompanyIdParamSchema = z.object({
	id: z.string().uuid({ message: 'errors.agent_company.id.invalid' }),
})

/**
 * Type for the ID parameter.
 * @public
 */
export type AgentCompanyIdParam = z.infer<typeof AgentCompanyIdParamSchema>
