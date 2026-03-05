import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Approval state enum.
 *
 * @beta
 */
export const ApprovalStateSchema = z.enum([
	'Pending',
	'Approved',
	'Rejected',
	'Cancelled',
])

/**
 * @beta
 */
export type ApprovalState = z.infer<typeof ApprovalStateSchema>

/**
 * Approval template enum.
 *
 * @beta
 */
export const ApprovalTemplateSchema = z.enum(['Standard', 'Express', 'Custom'])

/**
 * @beta
 */
export type ApprovalTemplate = z.infer<typeof ApprovalTemplateSchema>

/**
 * Base schema for Approval entity.
 *
 * @beta
 */
export const ApprovalBaseSchema = z
	.object({
		approvalId: z.string(),
		approvalState: ApprovalStateSchema,
		decisionDate: InstantUTC.optional(),
		counters: z.number().int().optional(),
		template: ApprovalTemplateSchema.optional(),
		note: z.string().max(1000).optional(),
		prerequisite: z.boolean().optional(),
	})
	.describe('Base Approval')

/**
 * @beta
 */
export type ApprovalBase = z.infer<typeof ApprovalBaseSchema>

/**
 * Expanded schema for Approval entity with relationships.
 *
 * @beta
 */
export const ApprovalExpandedSchema = ApprovalBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded Approval with relationships')

/**
 * @beta
 */
export type ApprovalExpanded = z.infer<typeof ApprovalExpandedSchema>

/**
 * @beta
 */
export type Approval = ApprovalExpanded

/**
 * Schema for creating a new Approval.
 *
 * @beta
 */
export const CreateApprovalInputSchema = ApprovalBaseSchema.omit({ approvalId: true })

/**
 * @beta
 */
export type CreateApprovalInput = z.infer<typeof CreateApprovalInputSchema>

/**
 * Schema for updating an Approval.
 *
 * @beta
 */
export const UpdateApprovalInputSchema = ApprovalBaseSchema.omit({
	approvalId: true,
}).partial()

/**
 * @beta
 */
export type UpdateApprovalInput = z.infer<typeof UpdateApprovalInputSchema>
