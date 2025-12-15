import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { MLS } from '../value-objects/contraints.js'
import { trimmedStringMinMax } from './base-schemas.js'

/**
 * MLS lifecycle status enum.
 *
 * @public
 */
export const MLSLifecycleStatusSchema = z
	.enum([
		'active',
		'archived',
		'missing_broker_agent',
		'closed',
		'in_build',
		'pending',
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
	.enum(['association', 'mls', 'commercial', 'unknown', 'technology_company'])
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
		id: z
			.string()
			.regex(/^\d+$/, { message: 'errors.mls.id.invalid' })
			.describe('Primary key (bigint as string)'),
		ouid: z.string().max(MLS.ouid.max).optional(),
		globalId: z.number().int().optional(),
		lifecycleStatus: MLSLifecycleStatusSchema,
		name: trimmedStringMinMax(MLS.name.min, MLS.name.max, 'MLS name must be between 1 and 255 characters'),
		shortName: z.string().max(MLS.shortName.max).optional(),
		website: z.string().max(MLS.website.max).optional(),
		orgType: MLSOrgTypeSchema,
		kunversionUrl: z.string().max(MLS.kunversionUrl.max).optional(),
		addressId: z.string().optional(),
	})
	.merge(AuditableSchema)
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
export type MLSType = MLSExpanded

/**
 * Schema for creating a new MLS.
 * Omits auto-generated fields (id, created, lastModified, modifiedBy).
 *
 * @public
 */
export const CreateMLSInputSchema = MLSBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
})

/**
 * @public
 */
export type CreateMLSInput = z.infer<typeof CreateMLSInputSchema>

/**
 * Schema for updating an MLS.
 * All fields are optional for partial updates.
 * Omits auto-generated fields.
 *
 * @public
 */
export const UpdateMLSInputSchema = MLSBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
}).partial()

/**
 * @public
 */
export type UpdateMLSInput = z.infer<typeof UpdateMLSInputSchema>

/**
 * Zod schema for validating MLS id path parameter.
 *
 * @public
 */
export const MLSIdParamSchema = z.object({
	id: MLSBaseSchema.shape.id,
})

/**
 * TypeScript type for MLS id path parameter.
 *
 * @public
 */
export type MLSIdParam = z.infer<typeof MLSIdParamSchema>
