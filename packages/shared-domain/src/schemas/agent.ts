// packages/shared-domain/src/schemas/agent.ts
import { z } from 'zod'
import {
	NameBranded,
} from '../value-objects/index.js'
import { AuditableSchema } from './audit.js'

// --- Related entities
import { AgentCompanyExpandedSchema } from './agent-company.js'
import { AgentAddressSchema } from './agent-address.js'
import { AddressExpandedSchema } from './address.js'
import { lifecycleEnum } from './base-schemas.js'

// Allowed suffixes
/**
 * Allowed name suffixes for agents.
 * @public
 */
export const AgentSuffix = z
	.enum(['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'Esq'], {
		message: 'errors.agent.suffix.invalid',
	})
	.describe('Optional name suffix')

/**
 * Allowed title prefixes for agents.
 * @public
 */
export const AgentTitle = z
	.enum(['Mr', 'Mrs', 'Ms', 'Miss'], { message: 'errors.agent.title.invalid' })
	.describe('Agent title prefix')

/**
 * Agent lifecycle status values (lowercase).
 * @public
 */
export const AGENT_LIFECYCLE_VALUES = [
	'joining',
	'active',
	'inactive',
	'vested',
	'vested retired',
	'lead only',
] as const;

/**
 * Agent lifecycle status options.
 * Automatically lowercases input before validation.
 * @public
 */
export const AgentLifecycleStatus = lifecycleEnum(
	AGENT_LIFECYCLE_VALUES,
	'errors.agent.lifecycle_status.invalid'
).describe('Agent lifecycle status')

/**
 * Base schema for Agent entity.
 * Used for list views and minimal data fetching for performance.
 * Contains only essential fields without relationships.
 * 
 * @public
 */
export const AgentBaseSchema = z
	.object({
		id: z
			.string()
			.uuid({ message: 'errors.agent.id.invalid' })
			.describe('Primary key (UUID)'),

		agentId: z
			.string()
			.regex(/^\d+$/, { message: 'errors.agent.agentId.invalid' })
			.describe('Auto-generated agent ID (bigint as string)'),

		title: AgentTitle.nullable().optional().describe('Agent title (Mr, Mrs, Ms, Miss)'),

		firstName: NameBranded.describe('Agent first/given name'),
		middleName: NameBranded.nullable().optional().describe('Agent middle name'),
		lastName: NameBranded.describe('Agent last/family name'),
		suffix: AgentSuffix.nullable().optional().describe('Name suffix (Jr, Sr, PhD, etc.)'),
		preferredName: NameBranded.nullable().optional().describe('Display/preferred name'),

		birthDate: z.coerce.date().nullable().optional().describe('Agent birth date'),

		lifecycleStatus: AgentLifecycleStatus.describe('Agent lifecycle status'),

		systemId: z.number().int().nullable().optional().describe('System ID reference'),

		agentCompanyId: z
			.string()
			.uuid({ message: 'errors.agent.agentCompanyId.invalid' })
			.nullable()
			.optional()
			.describe('Foreign key to AgentCompany (UUID)'),

		seedAgent: z.boolean().default(false).describe('Whether agent is a seed agent'),
		joinDate: z.coerce.date().nullable().optional().describe('Date when agent joined'),
		anniversaryDate: z.coerce.date().nullable().optional().describe('Agent anniversary date'),
		terminationDate: z.coerce.date().nullable().optional().describe('Date when agent was terminated'),
		isStaff: z.boolean().default(false).describe('Whether agent is staff member'),
	})
	.merge(AuditableSchema)
	.describe('Base Agent for list views')

/**
 * Zod schema for a persisted agent entity.
 * @public
 */
export const AgentSchema = AgentBaseSchema.describe('Persisted Agent')

/**
 * TypeScript type for a persisted agent.
 * @public
 */
export type Agent = z.infer<typeof AgentSchema>

/**
 * Zod schema for creating a new agent.
 * Accepts untrimmed strings and pipes them through validation.
 * Omits system-generated fields (id, timestamps, agentId).
 * @public
 */
export const CreateAgentInputSchema = AgentBaseSchema.omit({
	id: true,
	agentId: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	mxid: true,
})
	.extend({
		firstName: z.string().trim().min(2).max(50).pipe(NameBranded),
		lastName: z.string().trim().min(2).max(50).pipe(NameBranded),
		middleName: z.string().trim().min(1).max(50).pipe(NameBranded).nullable().optional(),
		preferredName: z.string().trim().min(2).max(50).pipe(NameBranded).nullable().optional(),
	})
	.describe('Payload to create an agent')

/**
 * TypeScript type for agent creation payload.
 * @public
 */
export type CreateAgentInput = z.infer<typeof CreateAgentInputSchema>

/**
 * Zod schema for updating an existing agent.
 * All fields are optional for partial updates.
 * @public
 */
export const UpdateAgentInputSchema = CreateAgentInputSchema.partial().describe(
	'Partial update payload for an agent',
)

/**
 * TypeScript type for agent update payload.
 * @public
 */
export type UpdateAgentInput = z.infer<typeof UpdateAgentInputSchema>

// ---------------------------------------------------------------------------
// EXPANDED AGENT (includes optional relations)
// ---------------------------------------------------------------------------

/**
 * Zod schema for an agent with optional joined relations.
 * Includes:
 * - agentCompany (many-to-one)
 * - addresses (one-to-many through AgentAddress association)
 * @public
 */
export const AgentExpandedSchema = AgentSchema.extend({
	agentCompany: AgentCompanyExpandedSchema.optional().describe(
		'Associated AgentCompany record (many-to-one)',
	),

	addresses: z
		.array(
			AgentAddressSchema.extend({
				address: AddressExpandedSchema.optional(),
			}),
		)
		.optional()
		.describe('Associated addresses via AgentAddress join table'),
}).describe('Agent with optional joined relations (company, addresses)')

/**
 * TypeScript type for an agent with optional relations.
 * @public
 */
export type AgentExpanded = z.infer<typeof AgentExpandedSchema>

// ---------------------------------------------------------------------------
// PARAM SCHEMAS (for path/query validation)
// ---------------------------------------------------------------------------

/**
 * Zod schema for validating Agent ID path parameter.
 * Agent IDs are UUIDs.
 * @public
 */
export const AgentIdParamSchema = z.object({
	id: z
		.string()
		.uuid({ message: 'errors.agent.id.invalid' })
		.describe('Agent ID (UUID)'),
})

/**
 * TypeScript type for Agent ID path parameter.
 * @public
 */
export type AgentIdParam = z.infer<typeof AgentIdParamSchema>

// ---------------------------------------------------------------------------
// LEGACY EXPORTS (for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use CreateAgentInputSchema instead
 */
export const CreateAgentInput = CreateAgentInputSchema

/**
 * @deprecated Use UpdateAgentInputSchema instead
 */
export const UpdateAgentInput = UpdateAgentInputSchema
