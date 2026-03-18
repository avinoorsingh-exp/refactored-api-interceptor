import { z } from 'zod'

/**
 * Context enum for social media platforms.
 * @public
 */
export const SocialContextSchema = z.enum(['website', 'twitter', 'linkedin', 'facebook'])

/**
 * Base schema for Social entity.
 * Represents social media links for agents.
 * @public
 */
export const SocialBaseSchema = z.object({
	/**
	 * Primary key (BigInt as string).
	 * @public
	 */
	id: z.string().describe('Primary key (BigInt as string)'),

	/**
	 * Social media platform/context.
	 * @public
	 */
	context: SocialContextSchema,

	/**
	 * URL or handle for the social media profile.
	 * @public
	 */
	value: z.string().min(1).max(500),
})

/**
 * Expanded schema for Social with nested relationships.
 * @public
 */
export const SocialExpandedSchema = SocialBaseSchema

/**
 * Input schema for creating a new Social.
 * @public
 */
export const CreateSocialInput = SocialBaseSchema.omit({
	id: true,
})

/**
 * Input schema for updating an existing Social.
 * @public
 */
export const UpdateSocialInput = SocialBaseSchema.partial().required({ id: true })

/**
 * TypeScript type inferred from SocialBaseSchema.
 * @public
 */
export type Social = z.infer<typeof SocialBaseSchema>

/**
 * TypeScript type inferred from SocialExpandedSchema.
 * @public
 */
export type SocialExpanded = z.infer<typeof SocialExpandedSchema>

/**
 * TypeScript type for create input.
 * @public
 */
export type CreateSocialInputType = z.infer<typeof CreateSocialInput>

/**
 * TypeScript type for update input.
 * @public
 */
export type UpdateSocialInputType = z.infer<typeof UpdateSocialInput>
