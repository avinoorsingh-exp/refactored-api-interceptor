import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	OneToMany,
	ManyToOne,
	JoinColumn,
	ManyToMany,
} from 'typeorm'
import { AddressEntity } from './address.entity.js'
import { AuditableEntity } from './auditable.entity.js'
import { AgentEntity } from './agent.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

/**
 * Lifecycle status values for MLS.
 * @public
 */
export type MLSLifecycleStatus =
	| 'active'
	| 'unknown'
	| 'missing_broker_agent'
	| 'archived'
	| 'closed'
	| 'in_build'
	| 'pending'

/**
 * Organization type values for MLS.
 * @public
 */
export type MLSOrgType = 'mls' | 'board' | 'association'

/**
 * TypeORM entity for MLS table.
 * Stores Multiple Listing Service information for real estate agents.
 * @public
 */
@Entity({ name: 'mls', schema: 'core' })
export class MLSEntity extends AuditableEntity {
	/**
	 * Primary key (bigint).
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique MLS identifier', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Organization unique identifier (OUID).
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 6, behavior: 'partial', description: 'Organization unique identifier' })
	@Filterable()
	@Sortable()
	ouid?: string

	/**
	 * Global ID for cross-system reference.
	 * @public
	 */
	@Column({ name: 'global_id', type: 'integer', nullable: true, unique: true })
	@Searchable({ type: 'integer', weight: 5, behavior: 'exact', description: 'Global identifier for cross-system reference', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	globalId?: number

	/**
	 * MLS lifecycle status.
	 * @public
	 */
	@Column({
		name: 'lifecycle_status',
		type: 'text',
	})
	@Searchable({ weight: 6, behavior: 'exact', description: 'MLS lifecycle status (active, unknown, missing_broker_agent, archived, closed, in_build, pending)' })
	@Filterable()
	@Sortable()
	lifecycleStatus!: string

	/**
	 * MLS display name.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 10, behavior: 'partial', description: 'MLS display name' })
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * Short name or abbreviation.
	 * @public
	 */
	@Column({
		name: 'short_name',
		type: 'text',
		nullable: true,
	})
	@Searchable({ weight: 8, behavior: 'partial', description: 'MLS short name or abbreviation' })
	@Filterable()
	@Sortable()
	shortName?: string

	/**
	 * MLS website URL.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 4, behavior: 'partial', description: 'MLS website URL' })
	@Filterable()
	@Sortable()
	website?: string

	/**
	 * Organization type (mls, board, association).
	 * @public
	 */
	@Column({ name: 'org_type', type: 'text' })
	@Searchable({ weight: 6, behavior: 'exact', description: 'Organization type (mls, board, association)' })
	@Filterable()
	@Sortable()
	orgType!: string

	/**
	 * Kunversion URL for integration.
	 * @public
	 */
	@Column({
		name: 'kunversion_url',
		type: 'text',
		nullable: true,
	})
	@Searchable({ weight: 4, behavior: 'partial', description: 'Kunversion integration URL' })
	@Filterable()
	@Sortable()
	kunversionUrl?: string

	/**
	 * Foreign key to Address.
	 * @public
	 */
	@Column({ name: 'address_id', type: 'bigint', nullable: true })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Address ID reference', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	addressId?: string

	/**
	 * One-to-many relationship with AgentMLS.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@ManyToMany(() => AgentEntity, (agent) => agent.mls)
  	agents!: AgentEntity[];

	/**
	 * Many-to-One relationship with Address.
	 * @public
	 */
	@ManyToOne(() => AddressEntity, { nullable: true })
	@JoinColumn({ name: 'address_id' })
	address?: AddressEntity
}
