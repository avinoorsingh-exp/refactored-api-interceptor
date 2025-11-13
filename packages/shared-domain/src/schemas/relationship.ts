import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Relationship type enum.
 *
 * @public
 */
export const RelationshipTypeSchema = z
	.enum(['sponsor_primary', 'sponsor_successor', 'sponsor_adaptive', 'mentor_successor'])
	.describe('Relationship type')

/**
 * @public
 */
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>

/**
 * Base schema for Relationship entity.
 *
 * @public
 */
export const RelationshipBaseSchema = z
	.object({
		subjectAgentId: z.string().uuid(),
		objectAgentId: z.string().uuid(),
		type: RelationshipTypeSchema,
		lastModified: InstantUTC,
		created: InstantUTC,
	})
	.describe('Base Relationship')

/**
 * @public
 */
export type RelationshipBase = z.infer<typeof RelationshipBaseSchema>

/**
 * Expanded schema for Relationship entity with relationships.
 *
 * @public
 */
export const RelationshipExpandedSchema = RelationshipBaseSchema.extend({
	subjectAgent: z.lazy(() => z.any()).optional(),
	objectAgent: z.lazy(() => z.any()).optional(),
}).describe('Expanded Relationship with relationships')

/**
 * @public
 */
export type RelationshipExpanded = z.infer<typeof RelationshipExpandedSchema>

/**
 * @public
 */
export type Relationship = RelationshipExpanded

/**
 * Schema for creating a new Relationship.
 *
 * @public
 */
export const CreateRelationshipInputSchema = RelationshipBaseSchema

/**
 * @public
 */
export type CreateRelationshipInput = z.infer<typeof CreateRelationshipInputSchema>

/**
 * Schema for updating a Relationship.
 *
 * @public
 */
export const UpdateRelationshipInputSchema = RelationshipBaseSchema.partial()

/**
 * @public
 */
export type UpdateRelationshipInput = z.infer<typeof UpdateRelationshipInputSchema>
