import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'

/**
 * TypeORM entity for EmailForward table.
 * Database representation of email forwarding configuration.
 * @public
 */
@Entity({ name: 'email_forward', schema: 'core' })
export class EmailForwardEntity extends AuditableEntity {
	/**
	 * Auto-incrementing primary key.
	 * @public
	 */
	@PrimaryGeneratedColumn('increment')
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique email forward identifier' })
	@Filterable()
	@Sortable()
	id!: number

	/**
	 * Recipient identifier.
	 * @public
	 */
	@Column({ name: 'recipient_id', type: 'text' })
	@Searchable({ weight: 6, behavior: 'partial', description: 'Recipient identifier' })
	@Filterable()
	@Sortable()
	recipientId!: string

	/**
	 * Timestamp of last verification check.
	 * @public
	 */
	@Column({
		name: 'verified_last_checked',
		type: 'timestamp with time zone',
		nullable: true,
	})
	@Searchable({ type: 'date', weight: 3, behavior: 'range', description: 'Last verification check timestamp' })
	@Filterable()
	@Sortable()
	verifiedLastChecked?: Date

	/**
	 * Whether the email forward has been verified.
	 * @public
	 */
	@Column({ type: 'boolean', default: false })
	@Searchable({ type: 'boolean', weight: 5, behavior: 'exact', description: 'Whether email forward is verified' })
	@Filterable()
	@Sortable()
	verified!: boolean

	/**
	 * Forward identifier in external system.
	 * @public
	 */
	@Column({ name: 'forward_id', type: 'text' })
	@Searchable({ weight: 5, behavior: 'exact', description: 'Forward ID in external system' })
	@Filterable()
	@Sortable()
	forwardId!: string

	/**
	 * Timestamp when recipient was created.
	 * @public
	 */
	@Column({ name: 'recipient_created', type: 'timestamp with time zone', nullable: true })
	@Searchable({ type: 'date', weight: 3, behavior: 'range', description: 'Recipient creation timestamp' })
	@Filterable()
	@Sortable()
	recipientCreated?: Date

	/**
	 * Date when verification occurred.
	 * @public
	 */
	@Column({ name: 'verified_date', type: 'timestamp with time zone', nullable: true })
	@Searchable({ type: 'date', weight: 4, behavior: 'range', description: 'Verification date' })
	@Filterable()
	@Sortable()
	verifiedDate?: Date

	/**
	 * Language preference.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Language preference' })
	@Filterable()
	@Sortable()
	language?: string

	/**
	 * Foreign key to Agent (UUID).
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Agent ID reference (UUID)' })
	@Filterable()
	@Sortable()
	agentId!: string

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne('AgentEntity')
	@JoinColumn({ name: 'agent_id' })
	agent?: unknown
}
