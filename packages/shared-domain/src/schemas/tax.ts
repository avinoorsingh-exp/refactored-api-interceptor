import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { trimmedEnum, trimmedStringMinMax } from './base-schemas.js'

/**
 * Tax ID type enum values.
 * SSN - Social Security Number (US individuals)
 * GSN_HST - GST/HST Number (Canadian businesses)
 * EIN - Employer Identification Number (US businesses)
 *
 * @public
 */
export const TaxIdTypeSchema = trimmedEnum(
	['SSN', 'GSN_HST', 'EIN'] as const,
	'Tax ID type must be SSN, GSN_HST, or EIN',
)

/**
 * @public
 */
export type TaxIdType = z.infer<typeof TaxIdTypeSchema>

/**
 * Tax ID type values as array for iteration.
 * @public
 */
export const TAX_ID_TYPE_VALUES = ['SSN', 'GSN_HST', 'EIN'] as const

/**
 * Base schema for Tax entity.
 * Stores tax identifier information (SSN, EIN, GSN_HST) with encryption.
 *
 * @public
 */
export const TaxBaseSchema = z
	.object({
		id: z.string().uuid(),
		taxIdType: TaxIdTypeSchema.describe('Type of tax identifier'),
		value: z.string().min(1).describe('Masked tax ID for display (e.g., "*****6789")'),
		valueToken: z.string().optional().nullable().describe('HMAC-SHA256 token for secure lookups'),
	})
	.merge(AuditableSchema)
	.describe('Base Tax entity')

/**
 * @public
 */
export type TaxBase = z.infer<typeof TaxBaseSchema>

/**
 * Expanded schema for Tax entity with relationships.
 *
 * @public
 */
export const TaxExpandedSchema = TaxBaseSchema.extend({
	// Add relationships if needed in the future
}).describe('Expanded Tax with relationships')

/**
 * @public
 */
export type TaxExpanded = z.infer<typeof TaxExpandedSchema>

/**
 * @public
 */
export type Tax = TaxExpanded

// ==========================================
// Agent-Tax Junction Schemas
// ==========================================

/**
 * Base schema for AgentTax junction entity.
 * Links agents to their tax identifiers with primary flag.
 *
 * @public
 */
export const AgentTaxBaseSchema = z
	.object({
		id: z.string().uuid(),
		agentId: z.string().uuid(),
		taxId: z.string().uuid(),
		isPrimary: z.boolean().default(false),
	})
	.describe('Agent-Tax association')

/**
 * @public
 */
export type AgentTaxBase = z.infer<typeof AgentTaxBaseSchema>

/**
 * Expanded schema for AgentTax with nested Tax entity.
 *
 * @public
 */
export const AgentTaxExpandedSchema = AgentTaxBaseSchema.extend({
	tax: TaxBaseSchema.optional(),
}).describe('Agent-Tax with nested Tax')

/**
 * @public
 */
export type AgentTaxExpanded = z.infer<typeof AgentTaxExpandedSchema>

/**
 * @public
 */
export type AgentTax = AgentTaxExpanded

// ==========================================
// Create/Update Schemas
// ==========================================

/**
 * Schema for creating a new Tax via agent-scoped route.
 * Creates both Tax record and AgentTax association.
 *
 * @public
 */
export const CreateAgentTaxInputSchema = z
	.object({
		taxIdType: TaxIdTypeSchema,
		value: trimmedStringMinMax(1, 50, 'Tax ID value must be between 1 and 50 characters'),
		isPrimary: z.boolean().default(false),
	})
	.describe('Create agent tax input')

/**
 * @public
 */
export type CreateAgentTaxInput = z.infer<typeof CreateAgentTaxInputSchema>

/**
 * Schema for updating an AgentTax association.
 * Can update the tax value or isPrimary flag.
 *
 * @public
 */
export const UpdateAgentTaxInputSchema = z
	.object({
		value: trimmedStringMinMax(1, 50).optional(),
		isPrimary: z.boolean().optional(),
	})
	.describe('Update agent tax input')

/**
 * @public
 */
export type UpdateAgentTaxInput = z.infer<typeof UpdateAgentTaxInputSchema>

// ==========================================
// Path Parameter Schemas
// ==========================================

/**
 * Schema for validating agent tax path parameters.
 *
 * @public
 */
export const AgentTaxParamsSchema = z
	.object({
		id: z.string().uuid({ message: 'Agent ID must be a valid UUID' }),
		taxId: z.string().uuid({ message: 'Tax ID must be a valid UUID' }),
	})
	.describe('Agent tax path parameters')

/**
 * @public
 */
export type AgentTaxParams = z.infer<typeof AgentTaxParamsSchema>
