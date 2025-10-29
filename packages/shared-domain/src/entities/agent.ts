// packages/agents-model/src/entities/agent.ts
import { z } from 'zod'
import {
	NameBranded,
	EmailBranded,
	DateOnlyISO,
	InstantUTC,
} from '../value-objects/index.js'

// --- Related entities
import { AgentCompanyExpandedSchema } from './agent-company.js'
import { AgentAddressSchema } from './agent-address.js'
import { AddressExpandedSchema } from './address.js'

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
 * Agent lifecycle status options.
 * @public
 */
export const AgentLifecycleStatus = z
	.enum(['Joining', 'Active', 'Inactive', 'Vested', 'Vested Retired', 'Lead Only'], {
		message: 'errors.agent.lifecycle_status.invalid',
	})
	.describe('Agent lifecycle status')

/**
 * @internal
 */
const BaseAgent = z
	.strictObject({
		id: z
			.string()
			.uuid({ message: 'errors.agent.id.invalid' })
			.optional()
			.describe('Primary key for agent'),

		// FK → AgentCompany.id
		agentCompanyId: z
			.string()
			.uuid({ message: 'errors.agent.agentCompanyId.invalid' })
			.describe('Foreign key to AgentCompany'),

		firstName: NameBranded.describe('Agent’s given name (2–50 chars)'),
		lastName: NameBranded.describe('Agent’s family name (2–50 chars)'),
		preferredName: NameBranded.optional().describe('Display/preferred name'),
		suffix: AgentSuffix.optional().describe('Optional suffix'),

		email: EmailBranded.describe('Agent’s email (validated)'),

		birthDate: DateOnlyISO.describe('Birth date as YYYY-MM-DD'),

		createdAt: InstantUTC.optional().describe('When the agent record was created (UTC)'),
		updatedAt: InstantUTC.optional().describe(
			'When the agent record was last updated (UTC)',
		),
	})
	.describe('Base Agent (flat, with foreign keys)')

/**
 * Zod schema for a persisted agent entity.
 * @public
 */
export const AgentSchema = BaseAgent.required({
	id: true,
	createdAt: true,
	updatedAt: true,
}).describe('Persisted Agent')

/**
 * TypeScript type for a persisted agent.
 * @public
 */
export type Agent = z.infer<typeof AgentSchema>

/**
 * Zod schema for creating a new agent.
 * Accepts untrimmed strings and pipes them through validation.
 * @public
 */
export const CreateAgentInput = BaseAgent.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})
	.extend({
		firstName: z.string().trim().pipe(NameBranded),
		lastName: z.string().trim().pipe(NameBranded),
		preferredName: z.string().trim().pipe(NameBranded).optional(),
		email: z.string().trim().pipe(EmailBranded),
		birthDate: z.string().trim().pipe(DateOnlyISO),
	})
	.describe('Payload to create an agent')

/**
 * TypeScript type for agent creation payload.
 * @public
 */
export type CreateAgentInput = z.infer<typeof CreateAgentInput>

/**
 * Zod schema for updating an existing agent.
 * All fields are optional for partial updates.
 * @public
 */
export const UpdateAgentInput = CreateAgentInput.partial().describe(
	'Partial update payload for an agent',
)

/**
 * TypeScript type for agent update payload.
 * @public
 */
export type UpdateAgentInput = z.infer<typeof UpdateAgentInput>

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
