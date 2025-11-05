import { Entity, PrimaryGeneratedColumn, Column, OneToMany, JoinColumn } from 'typeorm'
import { StateEntity } from './state.entity.js'

/**
 * TypeORM entity for Region table.
 * @public
 */
@Entity({ name: 'region', schema: 'core' })
export class RegionEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: string

	@Column({ type: 'text' })
	name!: string
}
