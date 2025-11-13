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
}