import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { StateEntity } from './state.entity.js'
import { ProgramEntity } from './program.entity.js'

/**
 * TypeORM entity for StateProgram table.
 * Junction table linking States to Programs with an allowed flag.
 * @public
 */
@Entity({ name: 'state_program', schema: 'core' })
export class StateProgramEntity {
	@PrimaryColumn({ name: 'state_id', type: 'uuid' })
	stateId!: string

	@PrimaryColumn({ name: 'program_id', type: 'bigint' })
	programId!: bigint

	@Column({ type: 'boolean', default: true })
	allowed!: boolean

	@ManyToOne(() => StateEntity, (state) => state.statePrograms)
	@JoinColumn({ name: 'state_id' })
	state?: StateEntity

	@ManyToOne(() => ProgramEntity, (program) => program.statePrograms)
	@JoinColumn({ name: 'program_id' })
	program?: ProgramEntity
}
