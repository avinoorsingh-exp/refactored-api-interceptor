import { z } from 'zod'
import { DateOnlyISO } from '../value-objects/dates.js'
import { LICENSE } from '../value-objects/contraints.js'
import { trimmedStringMinMax, trimmedStringMax } from './base-schemas.js'

/**
 * License type enum.
 *
 * @public
 */
export const LicenseTypeSchema = z
	.enum(['Provisional Broker', 'Broker', 'BIC Eligible'])
	.describe('License type')

/**
 * @public
 */
export type LicenseType = z.infer<typeof LicenseTypeSchema>

/**
 * Base schema for License entity.
 *
 * @public
 */
export const LicenseBaseSchema = z
	.object({
		id: z.string().uuid({ message: 'errors.license.id.invalid' }),
		agentId: z.string().uuid({ message: 'errors.license.agentId.invalid' }),
		expirationDate: DateOnlyISO.nullable().optional(),
		isPrimary: z.boolean(),
		type: LicenseTypeSchema,
		firstName: z.string().min(LICENSE.firstName.min).max(LICENSE.firstName.max),
		middleName: z.string().max(LICENSE.middleName.max).nullable().optional(),
		lastName: z.string().min(LICENSE.lastName.min).max(LICENSE.lastName.max),
		suffix: z.string().max(LICENSE.suffix.max).nullable().optional(),
		number: z.string().min(LICENSE.number.min).max(LICENSE.number.max),
		lineOfBusinessId: z.string().nullable().optional(),
		countryId: z.number().int().positive({ message: 'errors.license.countryId.invalid' }),
		stateCode: z.string().length(2, { message: 'errors.license.stateCode.invalid' }).nullable().optional(),
	})
	.describe('Base License')

/**
 * @public
 */
export type LicenseBase = z.infer<typeof LicenseBaseSchema>

/**
 * Expanded schema for License entity with relationships.
 *
 * @public
 */
export const LicenseExpandedSchema = LicenseBaseSchema.extend({
	lineOfBusiness: z.lazy(() => z.any()).optional(),
	country: z.lazy(() => z.any()).optional(), // Country entity (direct relationship)
	state: z.lazy(() => z.any()).optional(), // State entity (virtual via countryId + stateCode)
	licenseEvents: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded License with relationships')

/**
 * @public
 */
export type LicenseExpanded = z.infer<typeof LicenseExpandedSchema>

/**
 * @public
 */
export type License = LicenseExpanded

/**
 * Schema for creating a new License.
 * Omits id and agentId (set from route).
 * Applies trimming to name fields before validation.
 *
 * @public
 */
export const CreateLicenseInputSchema = LicenseBaseSchema.omit({ id: true, agentId: true })
	.extend({
		// Apply trimming before validation using base-schemas utilities
		firstName: trimmedStringMinMax(LICENSE.firstName.min, LICENSE.firstName.max, 'errors.license.firstName.length'),
		middleName: trimmedStringMax(LICENSE.middleName.max, 'errors.license.middleName.length').nullable().optional(),
		lastName: trimmedStringMinMax(LICENSE.lastName.min, LICENSE.lastName.max, 'errors.license.lastName.length'),
		suffix: trimmedStringMax(LICENSE.suffix.max, 'errors.license.suffix.length').nullable().optional(),
		number: trimmedStringMinMax(LICENSE.number.min, LICENSE.number.max, 'errors.license.number.length'),
	})
	.describe('Payload to create a license')

/**
 * @public
 */
export type CreateLicenseInput = z.infer<typeof CreateLicenseInputSchema>

/**
 * Schema for updating a License.
 * All fields are optional for partial updates.
 * Applies trimming to name fields before validation.
 *
 * @public
 */
export const UpdateLicenseInputSchema = LicenseBaseSchema.omit({ id: true, agentId: true })
	.extend({
		// Apply trimming before validation using base-schemas utilities
		firstName: trimmedStringMinMax(LICENSE.firstName.min, LICENSE.firstName.max, 'errors.license.firstName.length').optional(),
		middleName: trimmedStringMax(LICENSE.middleName.max, 'errors.license.middleName.length').nullable().optional(),
		lastName: trimmedStringMinMax(LICENSE.lastName.min, LICENSE.lastName.max, 'errors.license.lastName.length').optional(),
		suffix: trimmedStringMax(LICENSE.suffix.max, 'errors.license.suffix.length').nullable().optional(),
		number: trimmedStringMinMax(LICENSE.number.min, LICENSE.number.max, 'errors.license.number.length').optional(),
		isPrimary: z.boolean().optional(),
		type: LicenseTypeSchema.optional(),
		expirationDate: DateOnlyISO.nullable().optional(),
		lineOfBusinessId: z.string().nullable().optional(),
		countryId: z.number().int().positive({ message: 'errors.license.countryId.invalid' }).optional(),
		stateCode: z.string().length(2, { message: 'errors.license.stateCode.invalid' }).nullable().optional(),
	})
	.partial()
	.describe('Partial update payload for a license')

/**
 * @public
 */
export type UpdateLicenseInput = z.infer<typeof UpdateLicenseInputSchema>

/**
 * Schema for validating License ID path parameter.
 * License IDs are UUIDs.
 * @public
 */
export const LicenseIdParamSchema = z.object({
	licenseId: z
		.string()
		.uuid({ message: 'errors.license.id.invalid' })
		.describe('License ID (UUID)'),
})

/**
 * @public
 */
export type LicenseIdParam = z.infer<typeof LicenseIdParamSchema>
