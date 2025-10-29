import { z } from 'zod'
import {
	InstantUTC,
	ADDRESS,
	PostalCodeBranded,
	CityBranded,
} from '../value-objects/index.js'

/**
 * ISO 3166-1 alpha-2 country codes.
 *
 * @public
 */
export const CountryCode = z
	.string({ message: 'errors.address.country.required' })
	.length(ADDRESS.countryAlpha2Len, { message: 'errors.address.country.alpha2' })
	.toUpperCase()
	.describe('ISO-3166 alpha-2 country code')

/**
 * @internal
 */
const Unit = z
	.string({ message: 'errors.address.unit.required' })
	.min(ADDRESS.unit.min, { message: 'errors.address.unit.min' })
	.max(ADDRESS.unit.max, { message: 'errors.address.unit.max' })

/**
 * @internal
 */
const Line = z
	.string({ message: 'errors.address.line.required' })
	.min(ADDRESS.line.min, { message: 'errors.address.line.min' })
	.max(ADDRESS.line.max, { message: 'errors.address.line.max' })

/**
 * Base schema for Address entity.
 * Used for list views and minimal data fetching for performance.
 * Contains only essential fields without relationships.
 *
 * @public
 */
export const AddressBaseSchema = z
	.object({
		id: z.string().uuid({ message: 'errors.address.id.invalid' }),
		line1: Line,
		city: CityBranded,
		unit: Unit,
		postalCode: PostalCodeBranded,
		country: CountryCode,
		createdAt: InstantUTC,
		updatedAt: InstantUTC,
	})
	.describe('Base Address for list views')

/**
 * Expanded schema for Address entity.
 * Includes all fields and relationships for detail views.
 * Use this when you need the complete object graph.
 *
 * @public
 */
export const AddressExpandedSchema = AddressBaseSchema.extend({
	line2: Line.nullable(),
	// Relationships loaded in expanded view
	agentAddresses: z.lazy(() => z.array(z.any())).optional(), // AgentAddressBaseSchema[]
	activeLocations: z.lazy(() => z.array(z.any())).optional(), // ActiveLocationBaseSchema[]
}).describe('Expanded Address with relationships')

/**
 * Type for base address data.
 *
 * @public
 */
export type AddressBase = z.infer<typeof AddressBaseSchema>

/**
 * Type for expanded address data with relationships.
 *
 * @public
 */
export type AddressExpanded = z.infer<typeof AddressExpandedSchema>

/**
 * Default type for address (use expanded).
 *
 * @public
 */
export type Address = AddressExpanded

/**
 * Legacy schema for backward compatibility.
 * @deprecated Use AddressExpandedSchema instead
 * @public
 */
export const AddressSchema = AddressExpandedSchema

/**
 * Zod schema for creating a new address.
 * Accepts untrimmed strings and pipes them through validation.
 * @public
 */
export const CreateAddressInput = z.object({
	line1: z.string().trim().pipe(Line),
	line2: z.string().trim().pipe(Line).optional().nullable(),
	city: z.string().trim().pipe(CityBranded),
	unit: z.string().trim().pipe(Unit),
	postalCode: z.string().trim().pipe(PostalCodeBranded),
	country: z.string().trim().pipe(CountryCode),
})

/**
 * TypeScript type for address creation payload.
 * @public
 */
export type CreateAddressInput = z.infer<typeof CreateAddressInput>

/**
 * Zod schema for updating an existing address.
 * All fields are optional for partial updates.
 * @public
 */
export const UpdateAddressInput = CreateAddressInput.partial()

/**
 * TypeScript type for address update payload.
 * @public
 */
export type UpdateAddressInput = z.infer<typeof UpdateAddressInput>
