import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'

/**
 * TypeORM entity for Region table.
 * @public
 */
@Entity('regions')
export class RegionEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: string

	@Column({ type: 'text' })
	name!: string

	/**
	 * One-to-many relationship with State.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('StateEntity', 'region')
	states?: unknown[]
}
