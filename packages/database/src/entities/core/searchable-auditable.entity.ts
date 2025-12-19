import { Searchable } from '../../decorators/searchable-decorators.js'
import { AuditableEntity } from './auditable.entity.js'

/**
 * Extended auditable entity with searchable audit fields.
 * 
 * Use this base class when you want created, lastModified, and modifiedBy
 * to be included in general text search.
 * 
 * For entities where audit fields should NOT be searchable (only filterable/sortable),
 * extend AuditableEntity directly instead.
 * 
 * @public
 */
export abstract class SearchableAuditableEntity extends AuditableEntity {
	@Searchable({ type: 'date', weight: 2, behavior: 'range', description: 'Record creation timestamp' })
	declare created: Date

	@Searchable({ type: 'date', weight: 2, behavior: 'range', description: 'Record last modified timestamp' })
	declare lastModified: Date

	@Searchable({ weight: 3, behavior: 'exact', description: 'User or system that last modified the record' })
	declare modifiedBy: string
}
