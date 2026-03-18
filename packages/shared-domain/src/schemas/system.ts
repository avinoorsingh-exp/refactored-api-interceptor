import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { trimmedStringMinMax, bigIntString } from './base-schemas.js'

/**
 * Base schema for System entity.
 * Represents a system configuration within a country with its associated currency.
 *
 * @public
 */
export const SystemBaseSchema = z
	.object({
		id: bigIntString('System ID must be a valid numeric string'),
		countryId: z.number().int().positive(),
		currencyId: z.number().int().positive(),
		description: trimmedStringMinMax(1, 500, 'Description must be between 1 and 500 characters'),
	})
	.merge(AuditableSchema)
	.describe('Base System')

/**
 * @public
 */
export type SystemBase = z.infer<typeof SystemBaseSchema>

/**
 * Expanded schema for System entity with relationships.
 *
 * @public
 */
export const SystemExpandedSchema = SystemBaseSchema.extend({
	// Country and Currency relations can be added when expanded
}).describe('Expanded System with relationships')

/**
 * @public
 */
export type SystemExpanded = z.infer<typeof SystemExpandedSchema>

/**
 * @public
 */
export type System = SystemExpanded

/**
 * API Response type for System with snake_case audit fields.
 * This represents the REST API contract.
 *
 * @public
 */
export type SystemApiResponse = Omit<System, 'created' | 'lastModified' | 'modifiedBy'> & {
	created: string
	last_modified: string
	modified_by: string
}

/**
 * Schema for creating a new System.
 * Omits auto-generated fields (id, audit fields) and countryId (comes from URL).
 *
 * @public
 */
export const CreateSystemInputSchema = z.object({
	currencyId: z.number().int().positive(),
	description: trimmedStringMinMax(1, 500, 'Description must be between 1 and 500 characters'),
})

/**
 * @public
 */
export type CreateSystemInput = z.infer<typeof CreateSystemInputSchema>

/**
 * Schema for updating a System.
 * All fields are optional.
 *
 * @public
 */
export const UpdateSystemInputSchema = CreateSystemInputSchema.partial()

/**
 * @public
 */
export type UpdateSystemInput = z.infer<typeof UpdateSystemInputSchema>

/**
 * Schema for validating system ID path parameter.
 *
 * @public
 */
export const SystemIdParamSchema = z
	.object({
		systemId: bigIntString('System ID must be a valid numeric string'),
	})
	.describe('System ID path parameter')

/**
 * @public
 */
export type SystemIdParam = z.infer<typeof SystemIdParamSchema>

/**
 * Schema for validating country ID path parameter (for nested routes).
 *
 * @public
 */
export const CountryIdParamSchema = z
	.object({
		countryId: z.coerce.number().int().positive(),
	})
	.describe('Country ID path parameter')

/**
 * @public
 */
export type CountryIdParam = z.infer<typeof CountryIdParamSchema>

/**
 * Schema for validating combined country ID and system ID path parameters.
 * Use this for routes that need both /:countryId/systems/:systemId
 *
 * @public
 */
export const CountrySystemParamSchema = z
	.object({
		countryId: z.coerce.number().int().positive(),
		systemId: bigIntString('System ID must be a valid numeric string'),
	})
	.describe('Combined country and system ID path parameters')

/**
 * @public
 */
export type CountrySystemParam = z.infer<typeof CountrySystemParamSchema>
