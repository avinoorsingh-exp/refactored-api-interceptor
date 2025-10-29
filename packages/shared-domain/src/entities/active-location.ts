import { z } from 'zod'
import { PostalCodeBranded } from '../value-objects/postal-code.js'
import { CityBranded } from '../value-objects/city.js'

/**
 * Base schema for ActiveLocation entity.
 *
 * @public
 */
export const ActiveLocationBaseSchema = z
	.object({
		name: z.string().min(1).max(255),
		agentId: z.string(),
		postalCode: PostalCodeBranded,
		city: CityBranded,
		isPrimary: z.boolean(),
	})
	.describe('Base ActiveLocation')

/**
 * @public
 */
export type ActiveLocationBase = z.infer<typeof ActiveLocationBaseSchema>

/**
 * Expanded schema for ActiveLocation with relationships.
 *
 * @public
 */
export const ActiveLocationExpandedSchema = ActiveLocationBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(),
}).describe('Expanded ActiveLocation with relationships')

/**
 * @public
 */
export type ActiveLocationExpanded = z.infer<typeof ActiveLocationExpandedSchema>

/**
 * @public
 */
export type ActiveLocation = ActiveLocationExpanded

/**
 * Schema for creating a new ActiveLocation.
 *
 * @public
 */
export const CreateActiveLocationInputSchema = ActiveLocationBaseSchema

/**
 * @public
 */
export type CreateActiveLocationInput = z.infer<typeof CreateActiveLocationInputSchema>

/**
 * Schema for updating an ActiveLocation.
 *
 * @public
 */
export const UpdateActiveLocationInputSchema = ActiveLocationBaseSchema.partial()

/**
 * @public
 */
export type UpdateActiveLocationInput = z.infer<typeof UpdateActiveLocationInputSchema>
