import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToOne,
	OneToMany,
	JoinColumn,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'
import type { SocialEntity } from './social.entity.js'

/**
 * TypeORM entity for PublicProfile table.
 * Stores publicly visible information for agent profiles.
 * @public
 */
@Entity({ name: 'public_profile', schema: 'core' })
export class PublicProfileEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Searchable({ weight: 3, behavior: 'exact', description: 'Unique public profile identifier (UUID)' })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Foreign key to Agent (UUID).
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Agent ID reference (UUID)' })
	@Filterable()
	@Sortable()
	agentId!: string

	/**
	 * Agent's public first name.
	 * @public
	 */
	@Column({ name: 'first_name', type: 'text', nullable: true })
	@Searchable({ weight: 9, behavior: 'partial', description: 'Public first name' })
	@Filterable()
	@Sortable()
	firstName?: string

	/**
	 * Agent's public last name.
	 * @public
	 */
	@Column({ name: 'last_name', type: 'text', nullable: true })
	@Searchable({ weight: 9, behavior: 'partial', description: 'Public last name' })
	@Filterable()
	@Sortable()
	lastName?: string

	/**
	 * Agent's public email address.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Public email address' })
	@Filterable()
	@Sortable()
	email?: string

	/**
	 * Agent's public phone number.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 7, behavior: 'partial', description: 'Public phone number' })
	@Filterable()
	@Sortable()
	phone?: string

	/**
	 * Whether to show title in public profile.
	 * @public
	 */
	@Column({ name: 'show_title', type: 'boolean', default: false })
	@Filterable()
	@Sortable()
	showTitle!: boolean

	/**
	 * Agent's public biography.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 6, behavior: 'partial', description: 'Public biography' })
	@Filterable()
	bio?: string

	/**
	 * Last synchronization timestamp.
	 * @public
	 */
	@Column({ name: 'last_sync', type: 'timestamp with time zone', nullable: true })
	@Filterable()
	@Sortable()
	lastSync?: Date

	/**
	 * Whether to exclude agent from public listings.
	 * @public
	 */
	@Column({ name: 'exclude_from_public', type: 'boolean', default: false })
	@Filterable()
	@Sortable()
	excludeFromPublic!: boolean

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne('AgentEntity')
	@JoinColumn({ name: 'agent_id' })
	agent?: unknown

	/**
	 * One-to-Many relationship with Social media links.
	 * @public
	 */
	@OneToMany('SocialEntity', 'publicProfile')
	socials?: SocialEntity[]
}
