import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { NoteEntity } from './note.entity.js'

/**
 * TypeORM entity for AgentNote junction table.
 * Many-to-many relationship between Agent and Note.
 *
 * @public
 */
@Entity({ name: 'agent_note', schema: 'core' })
export class AgentNoteEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * Foreign key to Agent.
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	/**
	 * Foreign key to Note.
	 * @public
	 */
	@Column({ name: 'note_id', type: 'uuid' })
	noteId!: string

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne(() => AgentEntity, (agent) => agent.agentNotes)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	/**
	 * Many-to-One relationship with Note.
	 * @public
	 */
	@ManyToOne(() => NoteEntity)
	@JoinColumn({ name: 'note_id' })
	note?: NoteEntity
}
