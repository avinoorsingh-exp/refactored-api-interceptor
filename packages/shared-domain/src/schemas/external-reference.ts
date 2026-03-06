import { z } from 'zod'
import { FullAuditableSchema } from './audit.js'

/**
 * Base schema for ExternalReference entity.
 * Used for storing external system identifiers and mappings.
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
	})
	.merge(FullAuditableSchema)
	.describe('Base ExternalReference for external system mappings')

/**
 * Expanded schema for ExternalReference entity.
 * Includes relationships for detail views.
 *
 * @public
 */
export const ExternalReferenceExpandedSchema = ExternalReferenceBaseSchema.extend({
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

export type ExternalReferenceBase = z.infer<typeof ExternalReferenceBaseSchema>
export type ExternalReferenceExpanded = z.infer<typeof ExternalReferenceExpandedSchema>
export type ExternalReference = ExternalReferenceExpanded

/** @deprecated Use ExternalReferenceExpandedSchema instead */
export const ExternalReferenceSchema = ExternalReferenceExpandedSchema

/**
 * Zod schema for creating a new external reference.
 * Omits system-generated fields (id, timestamps, modifiedBy).
 *
 * @public
 */
export const CreateExternalReferenceInput = ExternalReferenceBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
})
	.extend({
		systemCode: z.string().trim().min(1).max(100),
		refKey: z.string().trim().min(1).max(255),
		refValue: z.string().trim().min(1).max(255),
	})
	.describe('Payload to create an external reference')

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

export type UpdateExternalReferenceInput = z.infer<typeof UpdateExternalReferenceInput>
