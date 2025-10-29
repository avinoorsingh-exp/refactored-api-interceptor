import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'
import { MLS } from '../value-objects/contraints.js'

/**
 * MLS lifecycle status enum.
 *
 * @public
 */
export const MLSLifecycleStatusSchema = z
	.enum([
		'active',
		'archived',
		'missing_broker',
		'agent_closed',
		'in_build',
		'printing',
		'unknown',
	])
	.describe('MLS lifecycle status')

/**
 * @public
 */
export type MLSLifecycleStatus = z.infer<typeof MLSLifecycleStatusSchema>

/**
 * MLS organization type enum.
 *
 * @public
 */
export const MLSOrgTypeSchema = z
	.enum(['association', 'mls', 'commercial_mls', 'technology_company'])
	.describe('MLS organization type')

/**
 * @public
 */
export type MLSOrgType = z.infer<typeof MLSOrgTypeSchema>

/**
 * Base schema for MLS entity.
 *
 * @public
 */
export const MLSBaseSchema = z
	.object({
		mlsId: z.string(),
		ouid: z.string().max(MLS.ouid.max).optional(),
		globalId: z.number().int().optional(),
		lifecycleStatus: MLSLifecycleStatusSchema,
		name: z.string().min(MLS.name.min).max(MLS.name.max),
		shortName: z.string().max(MLS.shortName.max).optional(),
		website: z.string().max(MLS.website.max).optional(),
		orgType: MLSOrgTypeSchema,
		larversionUrl: z.string().max(MLS.larversionUrl.max).optional(),
		lastModified: InstantUTC,
		modifiedBy: z.string().max(MLS.modifiedBy.max),
		addressId: z.string().optional(),
	})
	.describe('Base MLS')

/**
 * @public
 */
export type MLSBase = z.infer<typeof MLSBaseSchema>

/**
 * Expanded schema for MLS entity with relationships.
 *
 * @public
 */
export const MLSExpandedSchema = MLSBaseSchema.extend({
	agentMLS: z.lazy(() => z.array(z.any())).optional(),
	address: z.lazy(() => z.any()).optional(),
}).describe('Expanded MLS with relationships')

/**
 * @public
 */
export type MLSExpanded = z.infer<typeof MLSExpandedSchema>

/**
 * @public
 */
export type MLS = MLSExpanded

/**
 * Schema for creating a new MLS.
 *
 * @public
 */
export const CreateMLSInputSchema = MLSBaseSchema.omit({ mlsId: true })

/**
 * @public
 */
export type CreateMLSInput = z.infer<typeof CreateMLSInputSchema>

/**
 * Schema for updating an MLS.
 *
 * @public
 */
export const UpdateMLSInputSchema = MLSBaseSchema.omit({ mlsId: true }).partial()

/**
 * @public
 */
export type UpdateMLSInput = z.infer<typeof UpdateMLSInputSchema>
