import type { Auditable } from '@exprealty/shared-domain'
import { CreateDateColumn, UpdateDateColumn, Column } from 'typeorm'
import { Sortable, Filterable, Searchable } from '../../decorators/searchable-decorators.js'

/**
 * Base entity class providing audit fields for all domain entities.
 * 
 * Includes:
 * - created: Timestamp when the record was created (auto-set on insert)
 * - lastModified: Timestamp when the record was last updated (auto-updated)
 * - modifiedBy: User/system identifier who last modified the record
 * 
 * @public
 */
export abstract class AuditableEntity implements Auditable {
	@CreateDateColumn({ name: 'created', type: 'timestamp with time zone' })
	@Searchable({ type: 'date', weight: 2, behavior: 'range', description: 'Record creation timestamp' })
	@Filterable()
	@Sortable()
	created!: Date

	@UpdateDateColumn({ name: 'last_modified', type: 'timestamp with time zone' })
	@Searchable({ type: 'date', weight: 2, behavior: 'range', description: 'Record last modified timestamp' })
	@Filterable()
	@Sortable()
	lastModified!: Date

	@Column({ name: 'modified_by', type: 'text', default: 'system' })
	@Searchable({ weight: 3, behavior: 'exact', description: 'User or system that last modified the record' })
	@Filterable()
	@Sortable()
	modifiedBy!: string

	/**
	 * Override toJSON to ensure only TypeScript property names (camelCase) are serialized,
	 * excluding database column names (snake_case) that TypeORM QueryBuilder may add.
	 */
	toJSON(): Record<string, any> {
		const obj: Record<string, any> = {}
		
		// Copy all own enumerable properties, excluding snake_case column names
		for (const key in this) {
			if (Object.prototype.hasOwnProperty.call(this, key) && !key.includes('_')) {
				obj[key] = this[key]
			}
		}
		
		return obj
	}
}