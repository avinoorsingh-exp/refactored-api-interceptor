import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { trimmedStringMinMax } from './base-schemas.js'

/**
 * Channel enum for contact methods.
 * @public
 */
export const ContactMethodChannelSchema = z.enum(['email', 'phone'])

/**
 * Sub-type enum for contact methods.
 * @public
 */
export const ContactMethodSubTypeSchema = z.enum([
	'mobile',
	'home',
	'work',
	'fax',
	'personal',
])

/**
 * Base schema for ContactMethod entity.
 * Represents various contact methods for agents (email, phone, etc.).
 * @public
 */
export const ContactMethodBaseSchema = z.object({
	/**
	 * Unique identifier (BigInt from legacy system).
	 * @public
	 */
	id: z.string().describe('Primary key (BigInt as string)'),

	/**
	 * Contact method name/label (unique).
	 * @public
	 */
	name: z.string().min(1).max(255),

	/**
	 * Communication channel type.
	 * @public
	 */
	channel: ContactMethodChannelSchema,

	/**
	 * Contact method sub-type (mobile, home, work, etc.).
	 * @public
	 */
	subType: ContactMethodSubTypeSchema.optional(),

	/**
	 * Contact value (email address or phone number).
	 * @public
	 */
	value: z.string().min(1).max(255),

	/**
	 * Whether this is the primary contact method.
	 * @public
	 */
	isPrimary: z.boolean(),

	/**
	 * Whether user has opted in for SMS notifications.
	 * @public
	 */
	smsOptIn: z.boolean().optional(),

	/**
	 * Foreign key to Agent entity.
	 * @public
	 */
	agentId: z.string().uuid({ message: 'errors.contactMethod.agentId.invalid' }),
}).merge(AuditableSchema)

/**
 * Expanded schema for ContactMethod with nested relationships.
 * @public
 */
export const ContactMethodExpandedSchema = ContactMethodBaseSchema.extend({
	/**
	 * Optional nested Agent object.
	 * @public
	 */
	agent: z.lazy(() => z.any()).optional(),
})

/**
 * Input schema for creating a new ContactMethod.
 * Note: agentId is omitted as it comes from the URL path in nested routes.
 * @public
 */
export const CreateContactMethodInput = ContactMethodBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	agentId: true,
}).extend({
	name: trimmedStringMinMax(1, 255, 'Contact method name must be between 1 and 255 characters'),
	value: trimmedStringMinMax(1, 255, 'Contact method value must be between 1 and 255 characters'),
})

/**
 * Input schema for updating an existing ContactMethod.
 * @public
 */
export const UpdateContactMethodInput = CreateContactMethodInput.partial()

/**
 * TypeScript type inferred from ContactMethodBaseSchema.
 * @public
 */
export type ContactMethod = z.infer<typeof ContactMethodBaseSchema>

/**
 * TypeScript type inferred from ContactMethodExpandedSchema.
 * @public
 */
export type ContactMethodExpanded = z.infer<typeof ContactMethodExpandedSchema>

/**
 * TypeScript type for create input.
 * @public
 */
export type CreateContactMethodInputType = z.infer<typeof CreateContactMethodInput>

/**
 * TypeScript type for update input.
 * @public
 */
export type UpdateContactMethodInputType = z.infer<typeof UpdateContactMethodInput>

/**
 * Schema for contact method ID path parameter.
 * @public
 */
export const ContactMethodIdParamSchema = z.object({
	/**
	 * Contact method ID (UUID).
	 * @public
	 */
	id: z.string().uuid({ message: 'errors.contactMethod.id.invalid' }),
})

/**
 * TypeScript type for contact method ID parameter.
 * @public
 */
export type ContactMethodIdParam = z.infer<typeof ContactMethodIdParamSchema>
