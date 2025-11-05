import { z } from 'zod'
import { InstantUTC } from '../value-objects/index.js'

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
	 * Contact method name/label.
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

	/**
	 * Timestamp when the contact method was created.
	 * @public
	 */
	createdAt: InstantUTC,

	/**
	 * Timestamp when the contact method was last updated.
	 * @public
	 */
	updatedAt: InstantUTC,
})

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
 * @public
 */
export const CreateContactMethodInput = ContactMethodBaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

/**
 * Input schema for updating an existing ContactMethod.
 * @public
 */
export const UpdateContactMethodInput = ContactMethodBaseSchema.partial().required({
	id: true,
})

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
