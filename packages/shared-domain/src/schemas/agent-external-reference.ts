import { z } from 'zod'

/**
 * Base schema for AgentExternalReference junction entity.
 * Links Agent entities with ExternalReference entities (many-to-many).
 * Uses composite primary key (agentId, externalReferenceId).
 *
 * @public
 */
export const AgentExternalReferenceBaseSchema = z
	.object({
		agentId: z
			.string()
			.uuid({ message: 'errors.agentExternalReference.agentId.invalid' })
			.describe('Foreign key to Agent (composite PK)'),
		externalReferenceId: z
			.string()
			.uuid({ message: 'errors.agentExternalReference.externalReferenceId.invalid' })
			.describe('Foreign key to ExternalReference (composite PK)'),
	})
	.describe('Base AgentExternalReference junction table')

/**
 * Expanded schema for AgentExternalReference with optional joined entities.
 * Includes nested agent and externalReference objects when loaded.
 *
 * @public
 */
export const AgentExternalReferenceExpandedSchema =
	AgentExternalReferenceBaseSchema.extend({
		agent: z
			.lazy(() => z.any())
			.optional()
			.describe('Associated Agent record (many-to-one)'),
		externalReference: z
			.lazy(() => z.any())
			.optional()
			.describe('Associated ExternalReference record (many-to-one)'),
	}).describe('Expanded AgentExternalReference with relationships')

/**
 * Type for base agent external reference data.
 *
 * @public
 */
export type AgentExternalReferenceBase = z.infer<typeof AgentExternalReferenceBaseSchema>

/**
 * Type for expanded agent external reference data with relationships.
 *
 * @public
 */
export type AgentExternalReferenceExpanded = z.infer<
	typeof AgentExternalReferenceExpandedSchema
>

/**
 * Default type for agent external reference (use expanded).
 *
 * @public
 */
export type AgentExternalReference = AgentExternalReferenceExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use AgentExternalReferenceExpandedSchema instead
 * @public
 */
export const AgentExternalReferenceSchema = AgentExternalReferenceExpandedSchema

/**
 * Zod schema for creating a new agent external reference link.
 * Requires both foreign keys.
 *
 * @public
 */
export const CreateAgentExternalReferenceInput =
	AgentExternalReferenceBaseSchema.describe(
		'Payload to create an agent external reference link',
	)

/**
 * TypeScript type for agent external reference creation payload.
 *
 * @public
 */
export type CreateAgentExternalReferenceInput = z.infer<
	typeof CreateAgentExternalReferenceInput
>
