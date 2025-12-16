import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToOne,
	JoinColumn,
} from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { AuditableEntity } from './auditable.entity.js'

/**
 * TypeORM entity for ContactMethod table.
 * Stores phone, email, and other contact methods for agents.
 * @public
 */
@Entity({ name: 'contact_method', schema: 'core' })
export class ContactMethodEntity extends AuditableEntity {
	/**
	 * Primary key (BigInt as string for large ID values).
	 * @public
	 */
	@PrimaryGeneratedColumn('increment')
	id!: string

	/**
	 * Contact method name/label.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	name!: string

	/**
	 * Communication channel type (email, phone).
	 * @public
	 */
	@Column({ type: 'text' })
	channel!: 'email' | 'phone'

	/**
	 * Contact method sub-type (mobile, home, work, fax, personal).
	 * @public
	 */
	@Column({ name: 'sub_type', type: 'text', nullable: true })
	subType?: 'mobile' | 'home' | 'work' | 'fax' | 'personal'

	/**
	 * Contact value (email address or phone number).
	 * @public
	 */
	@Column({ type: 'text' })
	value!: string

	/**
	 * Whether this is the primary contact method.
	 * @public
	 */
	@Column({ name: 'is_primary', type: 'boolean', default: false })
	isPrimary!: boolean

	/**
	 * Whether user has opted in for SMS notifications.
	 * @public
	 */
	@Column({ name: 'sms_opt_in', type: 'boolean', nullable: true })
	smsOptIn?: boolean

	/**
	 * Foreign key to Agent.
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity
}
