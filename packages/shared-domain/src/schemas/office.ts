import { z } from 'zod'
import { UrlBranded } from '../value-objects/index.js'
import { AuditableSchema } from './audit.js'
import { trimmedStringMinMax, lifecycleEnum } from './base-schemas.js'

/**
 * Office lifecycle status values.
 * @public
 */
export const OFFICE_LIFECYCLE_VALUES = [
	'new',
	'pending_due_diligence',
	'pending_payment',
	'active',
	'withdrawn',
	'missing_broker_agent',
] as const;

/**
 * Office lifecycle status.
 * Automatically lowercases input before validation.
 * @public
 */
export const OfficeLifecycleStatus = lifecycleEnum(
	OFFICE_LIFECYCLE_VALUES,
	'errors.office.lifecycle_status.invalid'
).describe('Office lifecycle status')

/**
 * Base schema for Office entity.
 * Used for list views and minimal data fetching.
 *
 * @public
 */
export const OfficeBaseSchema = z
	.object({
		id: z
			.string()
			.regex(/^\d+$/, { message: 'errors.office.id.invalid' })
			.describe('Primary key (bigint as string)'),
		website: UrlBranded.nullable().optional(),
		name: trimmedStringMinMax(1, 255, 'Office name must be between 1 and 255 characters'),
		phone: z.string().max(20).nullable().optional(),
		lifecycleStatus: OfficeLifecycleStatus,
		primaryState: z.string().max(200).nullable().optional(),
		companyId: z
			.string()
			.regex(/^\d+$/, { message: 'errors.office.companyId.invalid' })
			.describe('Foreign key to company (bigint as string)'),
	})
	.merge(AuditableSchema)
	.describe('Base Office for list views')

/**
 * Expanded schema for Office entity.
 * Includes relationships for detail views.
 *
 * @public
 */
export const OfficeExpandedSchema = OfficeBaseSchema.extend({
	company: z.lazy(() => z.any()).optional().describe('Parent company relationship'),
	agentOffice: z.lazy(() => z.array(z.any())).optional().describe('Associated agent-office junction records (includes isPrimary)'),
	agents: z.lazy(() => z.array(z.any())).optional().describe('Direct access to associated agents'),
	officeExternalReferences: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Office with relationships')

/**
 * @public
 */
export type OfficeBase = z.infer<typeof OfficeBaseSchema>

/**
 * @public
 */
export type OfficeExpanded = z.infer<typeof OfficeExpandedSchema>

/**
 * @public
 */
export type Office = OfficeExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use OfficeExpandedSchema instead
 * @public
 */
export const OfficeSchema = OfficeExpandedSchema

/**
 * Zod schema for creating a new office.
 * Omits system-generated fields (id, timestamps).
 *
 * @public
 */
export const CreateOfficeInputSchema = OfficeBaseSchema.omit({
	id: true,
	created: true,
	lastModified: true,
	modifiedBy: true,
	mxid: true,
})
	.extend({
		phone: trimmedStringMinMax(1, 20, 'Phone must be between 1 and 20 characters').nullable().optional(),
		primaryState: trimmedStringMinMax(1, 200, 'Primary state must be between 1 and 200 characters').nullable().optional(),
	})
	.describe('Input schema for creating a new office')

/**
 * Zod schema for updating an office.
 * All fields optional for partial updates.
 *
 * @public
 */
export const UpdateOfficeInputSchema = CreateOfficeInputSchema.partial().describe(
	'Input schema for updating an office'
)

/**
 * @public
 */
export type CreateOfficeInput = z.infer<typeof CreateOfficeInputSchema>

/**
 * @public
 */
export type UpdateOfficeInput = z.infer<typeof UpdateOfficeInputSchema>

/**
 * Zod schema for validating office id path parameter.
 * Reuses validation from OfficeBaseSchema.shape.id.
 *
 * @public
 */
export const OfficeIdParamSchema = z.object({
	id: OfficeBaseSchema.shape.id,
})

/**
 * TypeScript type for office id path parameter.
 *
 * @public
 */
export type OfficeIdParam = z.infer<typeof OfficeIdParamSchema>
