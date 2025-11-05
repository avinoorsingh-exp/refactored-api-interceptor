import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { StateEntity } from './state.entity.js'
import { ProgramEntity } from './program.entity.js'

/**
 * TypeORM entity for StateProgram table.
 * @public
 */
@Entity({ name: 'state_program', schema: 'core' })
export class StateProgramEntity {
	@PrimaryColumn({ name: 'state_id', type: 'uuid' })
	stateId!: string

	@PrimaryColumn({ name: 'program_id', type: 'uuid' })
	programId!: string

	@ManyToOne(() => StateEntity)
	@JoinColumn({ name: 'state_id' })
	state?: StateEntity

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program?: ProgramEntity
}
