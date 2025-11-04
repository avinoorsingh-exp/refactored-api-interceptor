import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	OneToMany,
	ManyToOne,
	JoinColumn,
} from 'typeorm'
import { AddressEntity } from './address.entity.js'

/**
 * TypeORM entity for MLS table.
 * Stores Multiple Listing Service information for real estate agents.
 * @public
 */
@Entity({ name: 'mls', schema: 'core' })
export class MLSEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	mlsId!: string

	@Column({ type: 'text', nullable: true })
	ouid?: string

	@Column({ name: 'global_id', type: 'integer', nullable: true })
	globalId?: number

	@Column({
		name: 'lifecycle_status',
		type: 'text',
	})
	lifecycleStatus!: string

	@Column({ type: 'text' })
	name!: string

	@Column({
		name: 'short_name',
		type: 'text',
		nullable: true,
	})
	shortName?: string

	@Column({ type: 'text', nullable: true })
	website?: string

	@Column({ name: 'org_type', type: 'text' })
	orgType!: string

	@Column({
		name: 'larversion_url',
		type: 'text',
		nullable: true,
	})
	larversionUrl?: string

	@Column({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date

	@Column({
		name: 'modified_by',
		type: 'text',
	})
	modifiedBy!: string

	@Column({ name: 'address_id', type: 'bigint', nullable: true })
	addressId?: string

	/**
	 * One-to-many relationship with AgentMLS.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('AgentMLSEntity', 'mls')
	agentMLS?: unknown[]

	@ManyToOne(() => AddressEntity, { nullable: true })
	@JoinColumn({ name: 'address_id' })
	address?: AddressEntity
}
