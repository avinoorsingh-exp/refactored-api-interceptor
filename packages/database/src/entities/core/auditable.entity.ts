import type { Auditable } from '@exprealty/shared-domain'
import { CreateDateColumn, UpdateDateColumn, Column } from 'typeorm'

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
	created!: Date

	@UpdateDateColumn({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date

	@Column({ name: 'modified_by', type: 'text', default: 'system' })
	modifiedBy!: string

	/**
	 * Override toJSON to ensure only TypeScript property names (camelCase) are serialized,
	 * excluding database column names (snake_case) that TypeORM QueryBuilder may add.
	 */
	toJSON() {
		const obj: Record<string, any> = {}
		
		// Copy all own enumerable properties
		for (const key in this) {
			if (Object.prototype.hasOwnProperty.call(this, key)) {
				// Skip snake_case properties (database column names)
				if (!key.includes('_')) {
					obj[key] = this[key]
				}
			}
		}
		
		return obj
	}
}