import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'

/**
 * TypeORM entity for Program table.
 * @public
 */
@Entity('programs')
export class ProgramEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	name!: string

	/**
	 * One-to-many relationship with StateProgram.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('StateProgramEntity', 'program')
	statePrograms?: unknown[]
}
