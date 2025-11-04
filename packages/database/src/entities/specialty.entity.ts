import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'

/**
 * TypeORM entity for Specialty table.
 * @public
 */
@Entity({ name: 'specialty', schema: 'core' })
export class SpecialtyEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: string

	@Column({ type: 'text' })
	name!: string

	/**
	 * One-to-many relationship with AgentSpecialty.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('AgentSpecialtyEntity', 'specialty')
	agentSpecialties?: unknown[]
}
