import { z } from 'zod'
import { InstantUTC, ADDRESS } from '../value-objects/index.js'
import { trimmedStringMinMax, trimmedStringMax } from './base-schemas.js'

/**
 * Address type enum (personal, company).
 * @public
 */
export const AddressType = z.enum(['personal', 'company'], {
	message: 'errors.address.type.invalid',
})

/**
 * Address role enum (contact, bill_to, pay_to, ship_to, return_to).
 * @public
 */
export const AddressRoleType = z.enum(['contact', 'bill_to', 'pay_to', 'ship_to', 'return_to'], {
	message: 'errors.address.role.invalid',
})

/**
 * Trimmed city name validator.
 * Allows international characters (no restrictive regex).
 * @internal
 */
const City = trimmedStringMinMax(ADDRESS.city.min, ADDRESS.city.max, 'errors.address.city.invalid')

/**
 * Trimmed postal code validator.
 * No regex - supports international formats.
 * @internal
 */
const PostalCode = trimmedStringMinMax(ADDRESS.postal.min, ADDRESS.postal.max, 'errors.address.postalCode.invalid')

/**
 * Trimmed unit validator.
 * @internal
 */
const Unit = trimmedStringMax(ADDRESS.unit.max, 'errors.address.unit.invalid')

/**
 * Trimmed address line validator.
 * @internal
 */
const Line = trimmedStringMinMax(ADDRESS.line.min, ADDRESS.line.max, 'errors.address.line.invalid')

/**
 * Trimmed county validator.
 * @internal
 */
const County = trimmedStringMax(ADDRESS.city.max, 'errors.address.county.invalid')

/**
 * Trimmed label validator.
 * @internal
 */
const Label = trimmedStringMax(ADDRESS.line.max, 'errors.address.label.invalid')

/**
 * Base schema for Address entity.
 * Used for list views and minimal data fetching for performance.
 * Contains only essential fields without relationships.
 *
 * @public
 */
export const AddressBaseSchema = z
	.object({
		id: z.string({ message: 'errors.address.id.invalid' }),
		type: AddressType.nullable().optional(),
		role: AddressRoleType.nullable().optional(),
		line1: Line,
		line2: Line.nullable().optional(),
		city: City,
		unit: Unit.nullable().optional(),
		postalCode: PostalCode,
		county: County.nullable().optional(),
		label: Label.nullable().optional(),
		stateId: z.string().uuid({ message: 'errors.address.stateId.invalid' }),
		created: InstantUTC,
		lastModified: InstantUTC,
		modifiedBy: z.string().optional(),
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
	// Relationships loaded in expanded view
	state: z.lazy(() => z.any()).optional(),
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
 * Uses trimmed validators from base-schemas.
 * @public
 */
export const CreateAddressInput = z.object({
	type: AddressType.optional(),
	role: AddressRoleType.optional(),
	line1: Line,
	line2: Line.optional().nullable(),
	city: City,
	unit: Unit.optional().nullable(),
	postalCode: PostalCode,
	county: County.optional().nullable(),
	label: Label.optional().nullable(),
	stateId: z.string().uuid(),
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
