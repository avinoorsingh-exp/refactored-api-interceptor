import { z } from 'zod'
import { trimmedStringMin } from './base-schemas.js';
/**
 * Base audit fields schema for all domain entities.
 *
 * Provides standard audit trail:
 * - created: When the record was created
 * - lastModified: When the record was last updated
 * - modifiedBy: Who last modified the record (user ID or 'system')
 * - mxid: Legacy database ID for data migration (nullable)
 *
 * @public
 */
export const AuditableSchema = z.object({
	created: z.coerce.date(),
	lastModified: z.coerce.date(),
	modifiedBy: trimmedStringMin(1).default('system'),
	mxid: z.coerce.string().nullable().optional(),
})

/**
 * Type representing auditable fields.
 * @public
 */
export type Auditable = z.infer<typeof AuditableSchema>

/**
 * Extended audit fields schema that also tracks who created the record.
 *
 * Adds:
 * - createdBy: Who created the record (user ID or 'system')
 *
 * Use for new entities (post phase-1) that need full audit trail.
 *
 * @public
 */
export const FullAuditableSchema = AuditableSchema.extend({
	createdBy: trimmedStringMin(1).default('system'),
})

/**
 * Type representing full auditable fields.
 * @public
 */
export type FullAuditable = z.infer<typeof FullAuditableSchema>