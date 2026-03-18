import { z } from 'zod'
import { InstantUTC } from '../value-objects/index.js'

/**
 * Base schema for EmailForward entity.
 * Represents email forwarding configuration for agents.
 * @public
 */
export const EmailForwardBaseSchema = z.object({
	/**
	 * Auto-incrementing primary key.
	 * @public
	 */
	id: z.number().int().positive(),

	/**
	 * Recipient identifier (TEXT).
	 * @public
	 */
	recipientId: z.string().min(1).max(255),

	/**
	 * Timestamp of last verification check.
	 * @public
	 */
	verifiedLastChecked: InstantUTC.optional(),

	/**
	 * Whether the email forward has been verified.
	 * @public
	 */
	verified: z.boolean(),

	/**
	 * Timestamp when the email forward was created.
	 * @public
	 */
	created: InstantUTC,

	/**
	 * Forward identifier in external system.
	 * @public
	 */
	forwardId: z.string().min(1).max(255),

	/**
	 * Timestamp when recipient was created.
	 * @public
	 */
	recipientCreated: InstantUTC.optional(),

	/**
	 * Date when verification occurred.
	 * @public
	 */
	verifiedDate: InstantUTC.optional(),

	/**
	 * Language preference (TEXT).
	 * @public
	 */
	language: z.string().max(50).optional(),
})

/**
 * Expanded schema for EmailForward with nested relationships.
 * @public
 */
export const EmailForwardExpandedSchema = EmailForwardBaseSchema

/**
 * Input schema for creating a new EmailForward.
 * @public
 */
export const CreateEmailForwardInput = EmailForwardBaseSchema.omit({
	id: true,
})

/**
 * Input schema for updating an existing EmailForward.
 * @public
 */
export const UpdateEmailForwardInput = EmailForwardBaseSchema.partial().required({
	id: true,
})

/**
 * TypeScript type inferred from EmailForwardBaseSchema.
 * @public
 */
export type EmailForward = z.infer<typeof EmailForwardBaseSchema>

/**
 * TypeScript type inferred from EmailForwardExpandedSchema.
 * @public
 */
export type EmailForwardExpanded = z.infer<typeof EmailForwardExpandedSchema>

/**
 * TypeScript type for create input.
 * @public
 */
export type CreateEmailForwardInputType = z.infer<typeof CreateEmailForwardInput>

/**
 * TypeScript type for update input.
 * @public
 */
export type UpdateEmailForwardInputType = z.infer<typeof UpdateEmailForwardInput>
