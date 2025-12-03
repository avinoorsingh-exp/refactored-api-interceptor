import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'

/**
 * TypeORM entity for Program table.
 * Programs represent features/capabilities that can be enabled per state.
 * @public
 */
@Entity({ name: 'program', schema: 'core' })
export class ProgramEntity extends AuditableEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: bigint

	@Column({ type: 'text' })
	code!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', nullable: true })
	description?: string

	/**
	 * One-to-many relationship with StateProgram.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('StateProgramEntity', 'program')
	statePrograms?: unknown[]
}
