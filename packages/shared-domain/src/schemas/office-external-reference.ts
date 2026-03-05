import { z } from 'zod'

/**
 * Base schema for OfficeExternalReference junction entity.
 * Links Office entities with ExternalReference entities (many-to-many).
 * Uses composite primary key (officeId, externalReferenceId).
 *
 * @public
 */
export const OfficeExternalReferenceBaseSchema = z
	.object({
		officeId: z
			.string()
			.uuid({ message: 'errors.officeExternalReference.officeId.invalid' })
			.describe('Foreign key to Office (composite PK)'),
		externalReferenceId: z
			.string()
			.uuid({ message: 'errors.officeExternalReference.externalReferenceId.invalid' })
			.describe('Foreign key to ExternalReference (composite PK)'),
	})
	.describe('Base OfficeExternalReference junction table')

/**
 * Expanded schema for OfficeExternalReference with optional joined entities.
 * Includes nested office and externalReference objects when loaded.
 *
 * @public
 */
export const OfficeExternalReferenceExpandedSchema =
	OfficeExternalReferenceBaseSchema.extend({
		office: z
			.lazy(() => z.any())
			.optional()
			.describe('Associated Office record (many-to-one)'),
		externalReference: z
			.lazy(() => z.any())
			.optional()
			.describe('Associated ExternalReference record (many-to-one)'),
	}).describe('Expanded OfficeExternalReference with relationships')

/**
 * Type for base office external reference data.
 *
 * @public
 */
export type OfficeExternalReferenceBase = z.infer<
	typeof OfficeExternalReferenceBaseSchema
>

/**
 * Type for expanded office external reference data with relationships.
 *
 * @public
 */
export type OfficeExternalReferenceExpanded = z.infer<
	typeof OfficeExternalReferenceExpandedSchema
>

/**
 * Default type for office external reference (use expanded).
 *
 * @public
 */
export type OfficeExternalReference = OfficeExternalReferenceExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use OfficeExternalReferenceExpandedSchema instead
 * @public
 */
export const OfficeExternalReferenceSchema = OfficeExternalReferenceExpandedSchema

/**
 * Zod schema for creating a new office external reference link.
 * Requires both foreign keys.
 *
 * @public
 */
export const CreateOfficeExternalReferenceInput =
	OfficeExternalReferenceBaseSchema.describe(
		'Payload to create an office external reference link',
	)

/**
 * TypeScript type for office external reference creation payload.
 *
 * @public
 */
export type CreateOfficeExternalReferenceInput = z.infer<
	typeof CreateOfficeExternalReferenceInput
>
