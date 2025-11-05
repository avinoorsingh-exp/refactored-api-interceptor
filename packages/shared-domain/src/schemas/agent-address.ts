import { z } from 'zod'
import { InstantUTC, DateOnlyISO } from '../value-objects/dates.js'

/**
 * Allowed roles for agent addresses.
 * @public
 */
export const AddressRole = z.enum(['home', 'office', 'mailing', 'billing', 'other'], {
	message: 'errors.agentAddress.role.invalid',
})

/**
 * @internal
 */
const BaseAgentAddress = z.strictObject({
	id: z.string().uuid({ message: 'errors.agentAddress.id.invalid' }).optional(),

	agentId: z.string().uuid({ message: 'errors.agentAddress.agentId.invalid' }),
	addressId: z.string().uuid({ message: 'errors.agentAddress.addressId.invalid' }),

	role: AddressRole.optional(),
	isPrimary: z.boolean().default(false),

	validFrom: DateOnlyISO.optional(),
	validTo: DateOnlyISO.optional(),

	createdAt: InstantUTC.optional(),
	updatedAt: InstantUTC.optional(),
})

/**
 * Zod schema for a persisted agent-address association.
 * @public
 */
export const AgentAddressSchema = BaseAgentAddress.required({
	id: true,
	createdAt: true,
	updatedAt: true,
})

/**
 * TypeScript type for a persisted agent-address association.
 * @public
 */
export type AgentAddress = z.infer<typeof AgentAddressSchema>

/**
 * Zod schema for creating a new agent-address association.
 * @public
 */
export const CreateAgentAddressInput = BaseAgentAddress.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
}).extend({
	// kept symmetrical for future branding, even though uuid already validated
	validFrom: z.string().trim().pipe(DateOnlyISO).optional(),
	validTo: z.string().trim().pipe(DateOnlyISO).optional(),
})

/**
 * TypeScript type for agent-address creation payload.
 * @public
 */
export type CreateAgentAddressInput = z.infer<typeof CreateAgentAddressInput>

/**
 * Zod schema for updating an agent-address association.
 * @public
 */
export const UpdateAgentAddressInput = CreateAgentAddressInput.partial()

/**
 * TypeScript type for agent-address update payload.
 * @public
 */
export type UpdateAgentAddressInput = z.infer<typeof UpdateAgentAddressInput>
