import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'
import { AuditableEntity } from './auditable.entity.js'

/**
 * TypeORM entity for LineOfBusiness table.
 * Extends AuditableEntity for created, lastModified, modifiedBy, mxid fields.
 * @public
 */
@Entity({ name: 'line_of_business', schema: 'core' })
export class LineOfBusinessEntity extends AuditableEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Auto-increment primary key', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	id!: string

	@Column({ type: 'text' })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Line of business name' })
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * One-to-many relationship with License.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('LicenseEntity', 'lineOfBusiness')
	licenses?: unknown[]
}
