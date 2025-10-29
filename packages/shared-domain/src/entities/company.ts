import { z } from 'zod'
import { EmailBranded, InstantUTC, NameBranded } from '../value-objects/index.js'

/**
 * Base schema for Company entity.
 * Used for list views and minimal data fetching for performance.
 * Contains only essential fields without relationships.
 *
 * @public
 */
export const CompanyBaseSchema = z
	.object({
		id: z
			.string()
			.uuid({ message: 'errors.company.id.invalid' })
			.describe('Primary key (UUID)'),
		name: NameBranded.describe('Company name'),
		email: EmailBranded.describe('Company email address'),
		createdAt: InstantUTC.describe('Creation timestamp'),
		updatedAt: InstantUTC.describe('Last update timestamp'),
	})
	.describe('Base Company for list views')

/**
 * Expanded schema for Company entity.
 * Includes all fields and relationships for detail views.
 * Use this when you need the complete object graph.
 *
 * @public
 */
export const CompanyExpandedSchema = CompanyBaseSchema.extend({
	// Relationships loaded in expanded view
	externalReferences: z
		.lazy(() => z.array(z.any()))
		.optional()
		.describe('External references associated with this company (many-to-many)'),
}).describe('Expanded Company with relationships')

/**
 * Type for base company data.
 *
 * @public
 */
export type CompanyBase = z.infer<typeof CompanyBaseSchema>

/**
 * Type for expanded company data with relationships.
 *
 * @public
 */
export type CompanyExpanded = z.infer<typeof CompanyExpandedSchema>

/**
 * Default type for company (use expanded).
 *
 * @public
 */
export type Company = CompanyExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use CompanyExpandedSchema instead
 * @public
 */
export const CompanySchema = CompanyExpandedSchema

/**
 * Zod schema for creating a new company.
 * Omits system-generated fields (id, timestamps).
 *
 * @public
 */
export const CreateCompanyInput = CompanyBaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})
	.extend({
		name: z.string().trim().min(2).max(255).pipe(NameBranded),
		email: z.string().trim().email().pipe(EmailBranded),
	})
	.describe('Payload to create a company')

/**
 * TypeScript type for company creation payload.
 *
 * @public
 */
export type CreateCompanyInput = z.infer<typeof CreateCompanyInput>

/**
 * Zod schema for updating an existing company.
 * All fields are optional for partial updates.
 *
 * @public
 */
export const UpdateCompanyInput = CreateCompanyInput.partial().describe(
	'Payload to update a company (partial)',
)

/**
 * TypeScript type for company update payload.
 *
 * @public
 */
export type UpdateCompanyInput = z.infer<typeof UpdateCompanyInput>
