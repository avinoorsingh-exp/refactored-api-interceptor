import { z } from 'zod'
import { DateOnlyISO } from '../value-objects/dates.js'

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
		id: z.string().uuid(),
		expirationDate: DateOnlyISO.optional(),
		isPrimary: z.boolean(),
		type: LicenseTypeSchema,
		firstName: z.string().min(1).max(100),
		middleName: z.string().max(100).optional(),
		lastName: z.string().min(1).max(100),
		suffix: z.string().max(20).optional(),
		number: z.string().min(1).max(100),
		lineOfBusinessId: z.string(),
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
 *
 * @public
 */
export const CreateLicenseInputSchema = LicenseBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateLicenseInput = z.infer<typeof CreateLicenseInputSchema>

/**
 * Schema for updating a License.
 *
 * @public
 */
export const UpdateLicenseInputSchema = LicenseBaseSchema.omit({ id: true }).partial()

/**
 * @public
 */
export type UpdateLicenseInput = z.infer<typeof UpdateLicenseInputSchema>
