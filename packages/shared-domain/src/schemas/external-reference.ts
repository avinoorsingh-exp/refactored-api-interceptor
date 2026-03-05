import { z } from 'zod'
import { InstantUTC } from '../value-objects/index.js'

/**
 * Base schema for ExternalReference entity.
 * Used for storing external system identifiers and mappings.
 * Contains core fields without relationships.
 *
 * @public
 */
export const ExternalReferenceBaseSchema = z
	.object({
		id: z
			.string()
			.uuid({ message: 'errors.externalReference.id.invalid' })
			.describe('Primary key (UUID)'),
		systemCode: z
			.string()
			.min(1)
			.max(100)
			.describe("External system identifier (e.g., 'SALESFORCE', 'LEGACY_CRM')"),
		refKey: z.string().min(1).max(255).describe('Reference key/type in external system'),
		refValue: z
			.string()
			.min(1)
			.max(255)
			.describe('Reference value/ID in external system'),
		createdAt: InstantUTC.describe('Creation timestamp'),
		updatedAt: InstantUTC.describe('Last update timestamp'),
	})
	.describe('Base ExternalReference for external system mappings')

/**
 * Expanded schema for ExternalReference entity.
 * Includes all fields and relationships for detail views.
 * Use this when you need the complete object graph.
 *
 * @public
 */
export const ExternalReferenceExpandedSchema = ExternalReferenceBaseSchema.extend({
	// Relationships loaded in expanded view (lazy to avoid circular dependencies)
	agents: z
		.lazy(() => z.array(z.any()))
		.optional()
		.describe('Agents associated with this external reference (many-to-many)'),
	offices: z
		.lazy(() => z.array(z.any()))
		.optional()
		.describe('Offices associated with this external reference (many-to-many)'),
	companies: z
		.lazy(() => z.array(z.any()))
		.optional()
		.describe('Companies associated with this external reference (many-to-many)'),
}).describe('Expanded ExternalReference with relationships')

/**
 * Type for base external reference data.
 *
 * @public
 */
export type ExternalReferenceBase = z.infer<typeof ExternalReferenceBaseSchema>

/**
 * Type for expanded external reference data with relationships.
 *
 * @public
 */
export type ExternalReferenceExpanded = z.infer<typeof ExternalReferenceExpandedSchema>

/**
 * Default type for external reference (use expanded).
 *
 * @public
 */
export type ExternalReference = ExternalReferenceExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use ExternalReferenceExpandedSchema instead
 * @public
 */
export const ExternalReferenceSchema = ExternalReferenceExpandedSchema

/**
 * Zod schema for creating a new external reference.
 * Omits system-generated fields (id, timestamps).
 *
 * @public
 */
export const CreateExternalReferenceInput = ExternalReferenceBaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})
	.extend({
		systemCode: z.string().trim().min(1).max(100),
		refKey: z.string().trim().min(1).max(255),
		refValue: z.string().trim().min(1).max(255),
	})
	.describe('Payload to create an external reference')

/**
 * TypeScript type for external reference creation payload.
 *
 * @public
 */
export type CreateExternalReferenceInput = z.infer<typeof CreateExternalReferenceInput>

/**
 * Zod schema for updating an existing external reference.
 * All fields are optional for partial updates.
 *
 * @public
 */
export const UpdateExternalReferenceInput =
	CreateExternalReferenceInput.partial().describe(
		'Payload to update an external reference (partial)',
	)

/**
 * TypeScript type for external reference update payload.
 *
 * @public
 */
export type UpdateExternalReferenceInput = z.infer<typeof UpdateExternalReferenceInput>
