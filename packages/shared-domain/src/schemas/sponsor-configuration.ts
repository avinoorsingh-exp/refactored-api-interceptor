import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Base schema for SponsorConfiguration entity.
 *
 * @public
 */
export const SponsorConfigurationBaseSchema = z
	.object({
		agentId: z.string(),
		uuid: z.string().uuid(),
		buffer: z.number().int(),
		sponsorBufferOverride: z.boolean(),
		lastModified: InstantUTC,
	})
	.describe('Base SponsorConfiguration')

/**
 * @public
 */
export type SponsorConfigurationBase = z.infer<typeof SponsorConfigurationBaseSchema>

/**
 * Expanded schema for SponsorConfiguration entity with relationships.
 *
 * @public
 */
export const SponsorConfigurationExpandedSchema = SponsorConfigurationBaseSchema.extend({
	agent: z.lazy(() => z.any()).optional(),
}).describe('Expanded SponsorConfiguration with relationships')

/**
 * @public
 */
export type SponsorConfigurationExpanded = z.infer<
	typeof SponsorConfigurationExpandedSchema
>

/**
 * @public
 */
export type SponsorConfiguration = SponsorConfigurationExpanded

/**
 * Schema for creating a new SponsorConfiguration.
 *
 * @public
 */
export const CreateSponsorConfigurationInputSchema = SponsorConfigurationBaseSchema

/**
 * @public
 */
export type CreateSponsorConfigurationInput = z.infer<
	typeof CreateSponsorConfigurationInputSchema
>

/**
 * Schema for updating a SponsorConfiguration.
 *
 * @public
 */
export const UpdateSponsorConfigurationInputSchema =
	SponsorConfigurationBaseSchema.partial()

/**
 * @public
 */
export type UpdateSponsorConfigurationInput = z.infer<
	typeof UpdateSponsorConfigurationInputSchema
>
