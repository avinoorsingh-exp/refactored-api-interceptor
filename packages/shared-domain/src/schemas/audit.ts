import { z } from 'zod'

/**
 * Base audit fields schema for all domain entities.
 * 
 * Provides standard audit trail:
 * - created: When the record was created
 * - lastModified: When the record was last updated
 * - modifiedBy: Who last modified the record (user ID or 'system')
 * 
 * @public
 */
export const AuditableSchema = z.object({
	created: z.coerce.date(),
	lastModified: z.coerce.date(),
	modifiedBy: z.string().min(1).default('system'),
})

/**
 * Type representing auditable fields.
 * @public
 */
export type Auditable = z.infer<typeof AuditableSchema>