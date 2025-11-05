import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	JoinColumn,
	OneToMany,
} from 'typeorm'
import { RegionEntity } from './region.entity.js'

/**
 * TypeORM entity for State table.
 * @public
 */
@Entity({ name: 'state', schema: 'core' })
export class StateEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text' })
	code!: string

	@Column({ name: 'is_active', type: 'boolean' })
	isActive!: boolean

	@Column({ type: 'text', nullable: true })
	email?: string

	@Column({
		name: 'signature_distribution_email',
		type: 'text',
		nullable: true,
	})
	signatureDistributionEmail?: string

	@Column({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date

	@Column({ name: 'modified_by', type: 'text' })
	modifiedBy!: string

	@Column({ name: 'region_id', type: 'bigint' })
	regionId!: bigint

	@ManyToOne(() => RegionEntity, (region) => region.id, { cascade: true, eager: false })
	@JoinColumn({ name: 'region_id' })
	region?: RegionEntity

	/**
	 * One-to-many relationship with StateProgram.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('StateProgramEntity', 'statePrograms')
	statePrograms?: unknown[]
}
