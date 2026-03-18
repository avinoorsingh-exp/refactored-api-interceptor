import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { trimmedStringMinMax, emailString, phoneE164String } from './base-schemas.js'

/**
 * Channel enum for contact methods.
 * @public
 */
export const ContactMethodChannelSchema = z.enum(['email', 'phone'])

/**
 * Sub-type enum for email contact methods.
 * Valid values: personal, work, home
 * @public
 */
export const EmailSubTypeSchema = z.enum(['personal', 'work', 'home'])

/**
 * Sub-type enum for phone contact methods.
 * Valid values: mobile, home, work, fax
 * @public
 */
export const PhoneSubTypeSchema = z.enum(['mobile', 'home', 'work', 'fax'])

/**
 * Sub-type enum for contact methods (all valid values).
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
 * Valid subTypes by channel for business rule validation.
 * @internal
 */
const VALID_SUBTYPES_BY_CHANNEL: Record<string, string[]> = {
	email: ['personal', 'work', 'home'],
	phone: ['mobile', 'home', 'work', 'fax'],
}

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
	 * Trimmed to prevent whitespace-only or padded duplicates.
	 * @public
	 */
	name: trimmedStringMinMax(1, 255, 'errors.contactMethod.name.length'),

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
 * Internal email validator for superRefine.
 * @internal
 */
const emailValidator = emailString('errors.contactMethod.value.invalidEmail')

/**
 * Internal E.164 phone validator for superRefine.
 * @internal
 */
const phoneValidator = phoneE164String('errors.contactMethod.value.invalidPhone')

/**
 * Input schema for creating a new ContactMethod.
 * Note: agentId is omitted as it comes from the URL path in nested routes.
 *
 * Business rules enforced via superRefine:
 * - Email channel: value must be valid email format, subType must be personal/work/home
 * - Phone channel: value must be E.164 format (+[country][number]), subType must be mobile/home/work/fax
 * @public
 */
export const CreateContactMethodInput = ContactMethodBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	agentId: true,
}).extend({
	name: trimmedStringMinMax(1, 255, 'errors.contactMethod.name.length'),
	value: trimmedStringMinMax(1, 255, 'errors.contactMethod.value.length'),
}).superRefine((data, ctx) => {
	// Validate value format based on channel
	if (data.channel === 'email') {
		const result = emailValidator.safeParse(data.value)
		if (!result.success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'errors.contactMethod.value.invalidEmail',
				path: ['value'],
			})
		}
	} else if (data.channel === 'phone') {
		const result = phoneValidator.safeParse(data.value)
		if (!result.success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'errors.contactMethod.value.invalidPhone',
				path: ['value'],
			})
		}
	}

	// Validate subType is appropriate for the channel
	if (data.subType) {
		const validSubTypes = VALID_SUBTYPES_BY_CHANNEL[data.channel]
		if (validSubTypes && !validSubTypes.includes(data.subType)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `errors.contactMethod.subType.invalidForChannel`,
				path: ['subType'],
			})
		}
	}
})

/**
 * Base schema for update input (without superRefine validation).
 * @internal
 */
const UpdateContactMethodInputBase = ContactMethodBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	agentId: true,
}).extend({
	name: trimmedStringMinMax(1, 255, 'errors.contactMethod.name.length').optional(),
	value: trimmedStringMinMax(1, 255, 'errors.contactMethod.value.length').optional(),
	channel: ContactMethodChannelSchema.optional(),
	subType: ContactMethodSubTypeSchema.optional(),
	isPrimary: z.boolean().optional(),
	smsOptIn: z.boolean().optional(),
})

/**
 * Input schema for updating an existing ContactMethod.
 * For partial updates, validation only occurs when both channel and value/subType are present.
 * Full validation should be performed at the service layer after merging with existing data.
 * @public
 */
export const UpdateContactMethodInput = UpdateContactMethodInputBase.superRefine((data, ctx) => {
	// Only validate value format if both channel and value are provided
	if (data.channel && data.value) {
		if (data.channel === 'email') {
			const result = emailValidator.safeParse(data.value)
			if (!result.success) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'errors.contactMethod.value.invalidEmail',
					path: ['value'],
				})
			}
		} else if (data.channel === 'phone') {
			const result = phoneValidator.safeParse(data.value)
			if (!result.success) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'errors.contactMethod.value.invalidPhone',
					path: ['value'],
				})
			}
		}
	}

	// Only validate subType if both channel and subType are provided
	if (data.channel && data.subType) {
		const validSubTypes = VALID_SUBTYPES_BY_CHANNEL[data.channel]
		if (validSubTypes && !validSubTypes.includes(data.subType)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `errors.contactMethod.subType.invalidForChannel`,
				path: ['subType'],
			})
		}
	}
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

/**
 * Schema for contact method ID path parameter.
 * @public
 */
export const ContactMethodIdParamSchema = z.object({
	/**
	 * Contact method ID (BigInt as string from legacy system).
	 * @public
	 */
	id: z.string().regex(/^\d+$/, { message: 'errors.contactMethod.id.invalid' }),
})

/**
 * TypeScript type for contact method ID parameter.
 * @public
 */
export type ContactMethodIdParam = z.infer<typeof ContactMethodIdParamSchema>
