import { Column } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Filterable, Sortable, Searchable } from '../../decorators/searchable-decorators.js'

/**
 * Extended auditable entity that also tracks who created the record.
 *
 * Adds:
 * - createdBy: User/system identifier who created the record (defaults to 'system')
 *
 * Use this for new entities (post phase-1) that need full audit trail.
 * Phase-1 entities continue using AuditableEntity until migration.
 *
 * @public
 */
export abstract class FullAuditableEntity extends AuditableEntity {
	@Column({ name: 'created_by', type: 'text', default: 'system' })
	@Filterable()
	@Sortable()
	createdBy!: string
}
