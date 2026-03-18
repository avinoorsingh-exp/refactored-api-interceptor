import { z } from 'zod'
import { UrlBranded } from '../value-objects/url.js'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Base schema for Artifact entity.
 *
 * @public
 */
export const ArtifactBaseSchema = z
	.object({
		id: z.string().uuid(),
		type: z.string().max(100),
		name: z.string().max(255),
		url: UrlBranded.optional(),
		storageKey: z.string().max(500).optional(),
		metadata: z.record(z.string(), z.any()).optional(),
		createdAt: InstantUTC,
		updatedAt: InstantUTC,
	})
	.describe('Base Artifact')

/**
 * @public
 */
export type ArtifactBase = z.infer<typeof ArtifactBaseSchema>

/**
 * Expanded schema for Artifact entity with relationships.
 *
 * @public
 */
export const ArtifactExpandedSchema = ArtifactBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded Artifact with relationships')

/**
 * @public
 */
export type ArtifactExpanded = z.infer<typeof ArtifactExpandedSchema>

/**
 * @public
 */
export type Artifact = ArtifactExpanded

/**
 * Schema for creating a new Artifact.
 *
 * @public
 */
export const CreateArtifactInputSchema = ArtifactBaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

/**
 * @public
 */
export type CreateArtifactInput = z.infer<typeof CreateArtifactInputSchema>

/**
 * Schema for updating an Artifact.
 *
 * @public
 */
export const UpdateArtifactInputSchema = ArtifactBaseSchema.omit({
	id: true,
	createdAt: true,
}).partial()

/**
 * @public
 */
export type UpdateArtifactInput = z.infer<typeof UpdateArtifactInputSchema>
