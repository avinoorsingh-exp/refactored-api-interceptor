import { z } from 'zod'
import { InstantUTC } from '../value-objects/index.js'

/**
 * Base schema for PublicProfile entity.
 * Represents an agent's public-facing profile information.
 * @public
 */
export const PublicProfileBaseSchema = z.object({
	/**
	 * Unique identifier for the public profile.
	 * @public
	 */
	id: z.string().uuid({ message: 'errors.publicProfile.id.invalid' }),

	/**
	 * Foreign key to Agent entity.
	 * @public
	 */
	agentId: z.string().uuid({ message: 'errors.publicProfile.agentId.invalid' }),

	/**
	 * Timestamp when the public profile was created.
	 * @public
	 */
	createdAt: InstantUTC,

	/**
	 * Timestamp when the public profile was last updated.
	 * @public
	 */
	updatedAt: InstantUTC,
})

/**
 * Expanded schema for PublicProfile with nested relationships.
 * @public
 */
export const PublicProfileExpandedSchema = PublicProfileBaseSchema.extend({
	/**
	 * Optional nested Agent object (lazy-loaded to avoid circular dependencies).
	 * @public
	 */
	agent: z.lazy(() => z.any()).optional(),
})

/**
 * Input schema for creating a new PublicProfile.
 * Omits auto-generated fields (id, timestamps).
 * @public
 */
export const CreatePublicProfileInput = PublicProfileBaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

/**
 * Input schema for updating an existing PublicProfile.
 * All fields are optional except id.
 * @public
 */
export const UpdatePublicProfileInput = PublicProfileBaseSchema.partial().required({
	id: true,
})

/**
 * TypeScript type inferred from PublicProfileBaseSchema.
 * @public
 */
export type PublicProfile = z.infer<typeof PublicProfileBaseSchema>

/**
 * TypeScript type inferred from PublicProfileExpandedSchema.
 * @public
 */
export type PublicProfileExpanded = z.infer<typeof PublicProfileExpandedSchema>

/**
 * TypeScript type for create input.
 * @public
 */
export type CreatePublicProfileInputType = z.infer<typeof CreatePublicProfileInput>

/**
 * TypeScript type for update input.
 * @public
 */
export type UpdatePublicProfileInputType = z.infer<typeof UpdatePublicProfileInput>
