import { z } from 'zod'

/**
 * Base schema for agent-address junction.
 * Composite key: (agentId, addressId).
 * @internal
 */
const BaseAgentAddress = z.strictObject({
	agentId: z.string().uuid({ message: 'errors.agentAddress.agentId.invalid' }),
	addressId: z.string({ message: 'errors.agentAddress.addressId.invalid' }),
	isPrimary: z.boolean().default(false),
})

/**
 * Zod schema for a persisted agent-address association.
 * @public
 */
export const AgentAddressSchema = BaseAgentAddress

/**
 * TypeScript type for a persisted agent-address association.
 * @public
 */
export type AgentAddress = z.infer<typeof AgentAddressSchema>

/**
 * Zod schema for creating a new agent-address association.
 * @public
 */
export const CreateAgentAddressInput = BaseAgentAddress

/**
 * TypeScript type for agent-address creation payload.
 * @public
 */
export type CreateAgentAddressInput = z.infer<typeof CreateAgentAddressInput>

/**
 * Zod schema for updating an agent-address association.
 * Only isPrimary can be updated (composite key is immutable).
 * @public
 */
export const UpdateAgentAddressInput = z.object({
	isPrimary: z.boolean().optional(),
})

/**
 * TypeScript type for agent-address update payload.
 * @public
 */
export type UpdateAgentAddressInput = z.infer<typeof UpdateAgentAddressInput>
