import type { Auditable } from '@exprealty/shared-domain'

/**
 * Maps audit fields from domain camelCase to API snake_case format.
 * 
 * Converts:
 * - created (Date) → created (ISO string)
 * - lastModified (Date) → last_modified (ISO string)
 * - modifiedBy (string) → modified_by (string)
 * 
 * @param entity - Entity with audit fields (created, lastModified, modifiedBy)
 * @returns Mapped audit fields in snake_case for API responses
 * 
 * @example
 * ```typescript
 * const region = { id: '1', name: 'Pacific', created: new Date(), lastModified: new Date(), modifiedBy: 'system' }
 * const response = { id: region.id, name: region.name, ...mapAuditFields(region) }
 * // { id: '1', name: 'Pacific', created: '2024-01-01T00:00:00.000Z', last_modified: '2024-01-01T00:00:00.000Z', modified_by: 'system' }
 * ```
 */
export function mapAuditFields<T extends Auditable>(entity: T): {
	created: string
	last_modified: string
	modified_by: string
} {
	return {
		created: entity.created.toISOString(),
		last_modified: entity.lastModified.toISOString(),
		modified_by: entity.modifiedBy,
	}
}
