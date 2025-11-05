import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { NoteEntity } from './note.entity.js'

/**
 * TypeORM entity for LifecycleEvent table.
 * @public
 */
@Entity({ name: 'lifecycle_event', schema: 'core' })
export class LifecycleEventEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	actor!: string

	@Column({ name: 'effective_date', type: 'timestamp with time zone' })
	effectiveDate!: Date

	@Column({ type: 'text' })
	type!: 'Onboarding' | 'Admin Hold'

	@Column({ type: 'boolean' })
	active!: boolean

	@Column({ name: 'note_id', type: 'uuid', nullable: true })
	noteId?: string

	@ManyToOne(() => NoteEntity, { nullable: true })
	@JoinColumn({ name: 'note_id' })
	note?: NoteEntity
}
