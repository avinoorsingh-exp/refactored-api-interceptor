import { z } from 'zod'

/**
 * Base schema for CompanyExternalReference junction entity.
 * Links Company entities with ExternalReference entities (many-to-many).
 * Uses composite primary key (companyId, externalReferenceId).
 *
 * @public
 */
export const CompanyExternalReferenceBaseSchema = z
	.object({
		companyId: z
			.string()
			.uuid({ message: 'errors.companyExternalReference.companyId.invalid' })
			.describe('Foreign key to Company (composite PK)'),
		externalReferenceId: z
			.string()
			.uuid({ message: 'errors.companyExternalReference.externalReferenceId.invalid' })
			.describe('Foreign key to ExternalReference (composite PK)'),
	})
	.describe('Base CompanyExternalReference junction table')

/**
 * Expanded schema for CompanyExternalReference with optional joined entities.
 * Includes nested company and externalReference objects when loaded.
 *
 * @public
 */
export const CompanyExternalReferenceExpandedSchema =
	CompanyExternalReferenceBaseSchema.extend({
		company: z
			.lazy(() => z.any())
			.optional()
			.describe('Associated Company record (many-to-one)'),
		externalReference: z
			.lazy(() => z.any())
			.optional()
			.describe('Associated ExternalReference record (many-to-one)'),
	}).describe('Expanded CompanyExternalReference with relationships')

/**
 * Type for base company external reference data.
 *
 * @public
 */
export type CompanyExternalReferenceBase = z.infer<
	typeof CompanyExternalReferenceBaseSchema
>

/**
 * Type for expanded company external reference data with relationships.
 *
 * @public
 */
export type CompanyExternalReferenceExpanded = z.infer<
	typeof CompanyExternalReferenceExpandedSchema
>

/**
 * Default type for company external reference (use expanded).
 *
 * @public
 */
export type CompanyExternalReference = CompanyExternalReferenceExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use CompanyExternalReferenceExpandedSchema instead
 * @public
 */
export const CompanyExternalReferenceSchema = CompanyExternalReferenceExpandedSchema

/**
 * Zod schema for creating a new company external reference link.
 * Requires both foreign keys.
 *
 * @public
 */
export const CreateCompanyExternalReferenceInput =
	CompanyExternalReferenceBaseSchema.describe(
		'Payload to create a company external reference link',
	)

/**
 * TypeScript type for company external reference creation payload.
 *
 * @public
 */
export type CreateCompanyExternalReferenceInput = z.infer<
	typeof CreateCompanyExternalReferenceInput
>
