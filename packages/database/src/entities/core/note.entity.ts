import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'

/**
 * TypeORM entity for Note table.
 * @public
 */
@Entity({ name: 'note', schema: 'core' })
export class NoteEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	actor!: string

	@Column({ type: 'text' })
	body!: string

	@Column({ type: 'timestamp with time zone' })
	date!: Date

	/**
	 * One-to-many relationship with LifecycleEvent.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('LifecycleEventEntity', 'note')
	lifecycleEvents?: unknown[]
}
