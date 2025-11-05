import { z } from 'zod'
import { EmailBranded } from '../value-objects/email.js'
import { PhoneNumberBranded } from '../value-objects/phone-number.js'

/**
 * Base schema for OrganizationContact entity.
 *
 * @public
 */
export const OrganizationContactBaseSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(255),
		email: EmailBranded.optional(),
		phone: PhoneNumberBranded.optional(),
		address: z.string().max(500).optional(),
	})
	.describe('Base OrganizationContact')

/**
 * @public
 */
export type OrganizationContactBase = z.infer<typeof OrganizationContactBaseSchema>

/**
 * Expanded schema for OrganizationContact entity with relationships.
 *
 * @public
 */
export const OrganizationContactExpandedSchema = OrganizationContactBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded OrganizationContact with relationships')

/**
 * @public
 */
export type OrganizationContactExpanded = z.infer<
	typeof OrganizationContactExpandedSchema
>

/**
 * @public
 */
export type OrganizationContact = OrganizationContactExpanded

/**
 * Schema for creating a new OrganizationContact.
 *
 * @public
 */
export const CreateOrganizationContactInputSchema = OrganizationContactBaseSchema.omit({
	id: true,
})

/**
 * @public
 */
export type CreateOrganizationContactInput = z.infer<
	typeof CreateOrganizationContactInputSchema
>

/**
 * Schema for updating an OrganizationContact.
 *
 * @public
 */
export const UpdateOrganizationContactInputSchema = OrganizationContactBaseSchema.omit({
	id: true,
}).partial()

/**
 * @public
 */
export type UpdateOrganizationContactInput = z.infer<
	typeof UpdateOrganizationContactInputSchema
>
