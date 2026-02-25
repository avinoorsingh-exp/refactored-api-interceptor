import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'

/**
 * TypeORM entity for Note table.
 * @public
 */
@Entity({ name: 'note', schema: 'core' })
export class NoteEntity extends AuditableEntity {
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	@Sortable()
	id!: string

	@Column({ type: 'text' })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Note author/actor' })
	@Filterable()
	@Sortable()
	actor!: string

	@Column({ type: 'text' })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Note body text' })
	@Filterable()
	body!: string

	/**
	 * One-to-many relationship with LifecycleEvent.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('LifecycleEventEntity', 'note')
	lifecycleEvents?: unknown[]
}
