import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentCompanyEntity } from './agent-company.entity.js'

/**
 * TypeORM entity for Agent table.
 * Database representation of the domain Agent type.
 * @public
 */
@Entity('agents')
export class AgentEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * Legacy agent ID from old system (BigInt).
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'bigint', nullable: true })
	agentId?: string

	/**
	 * Agent title (Mr., Mrs., Ms., Miss).
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	title?: 'Mr' | 'Mrs' | 'Ms' | 'Miss'

	/**
	 * Agent's given name.
	 * @public
	 */
	@Column({ name: 'first_name', type: 'text' })
	firstName!: string

	/**
	 * Agent's middle name (optional).
	 * @public
	 */
	@Column({ name: 'middle_name', type: 'text', nullable: true })
	middleName?: string

	/**
	 * Agent's family name.
	 * @public
	 */
	@Column({ name: 'last_name', type: 'text' })
	lastName!: string

	/**
	 * Name suffix (Jr, Sr, PhD, etc.) - optional.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	suffix?: string

	/**
	 * Agent's preferred/display name (optional).
	 * @public
	 */
	@Column({ name: 'preferred_name', type: 'text', nullable: true })
	preferredName?: string

	/**
	 * Agent's birth date.
	 * @public
	 */
	@Column({ name: 'birth_date', type: 'timestamp with time zone', nullable: true })
	birthDate?: Date

	/**
	 * Agent lifecycle status.
	 * @public
	 */
	@Column({ name: 'lifecycle_status', type: 'text', nullable: true })
	lifecycleStatus?:
		| 'Joining'
		| 'Active'
		| 'Inactive'
		| 'Vested'
		| 'Vested Retired'
		| 'Lead Only'

	/**
	 * Last modified timestamp.
	 * @public
	 */
	@Column({ name: 'last_modified', type: 'timestamp with time zone', nullable: true })
	lastModified?: Date

	/**
	 * System ID reference.
	 * @public
	 */
	@Column({ name: 'system_id', type: 'integer', nullable: true })
	systemId?: number

	/**
	 * Whether agent is a seed agent.
	 * @public
	 */
	@Column({ name: 'seed_agent', type: 'boolean', default: false })
	seedAgent!: boolean

	/**
	 * Date when agent joined.
	 * @public
	 */
	@Column({ name: 'join_date', type: 'timestamp with time zone', nullable: true })
	joinDate?: Date

	/**
	 * Agent's anniversary date.
	 * @public
	 */
	@Column({ name: 'anniversary_date', type: 'timestamp with time zone', nullable: true })
	anniversaryDate?: Date

	/**
	 * Date when agent was terminated.
	 * @public
	 */
	@Column({ name: 'termination_date', type: 'timestamp with time zone', nullable: true })
	terminationDate?: Date

	/**
	 * Whether agent is staff.
	 * @public
	 */
	@Column({ name: 'is_staff', type: 'boolean', default: false })
	isStaff!: boolean

	/**
	 * Foreign key to AgentCompany.
	 * @public
	 */
	@Column({ name: 'agent_company_id', type: 'uuid' })
	agentCompanyId!: string

	/**
	 * Many-to-One relationship with AgentCompany.
	 * @public
	 */
	@ManyToOne(() => AgentCompanyEntity)
	@JoinColumn({ name: 'agent_company_id' })
	agentCompany?: AgentCompanyEntity
}
