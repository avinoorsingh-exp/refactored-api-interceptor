import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToOne,
	JoinColumn,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { AddressEntity } from './address.entity.js'

/**
 * TypeORM entity for AgentAddress join table.
 * Database representation of the domain AgentAddress type.
 * Represents the many-to-many relationship between agents and addresses.
 * @public
 */
@Entity('agent_addresses')
export class AgentAddressEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * Foreign key to Agent.
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	/**
	 * Foreign key to Address.
	 * @public
	 */
	@Column({ name: 'address_id', type: 'uuid' })
	addressId!: string

	/**
	 * Role/type of address (home, office, mailing, billing, other).
	 * @public
	 */
	@Column({ type: 'varchar', length: 20, nullable: true })
	role?: 'home' | 'office' | 'mailing' | 'billing' | 'other'

	/**
	 * Whether this is the primary address for the agent.
	 * @public
	 */
	@Column({ name: 'is_primary', type: 'boolean', default: false })
	isPrimary!: boolean

	/**
	 * Date from which this address is valid (YYYY-MM-DD) - optional.
	 * @public
	 */
	@Column({ name: 'valid_from', type: 'date', nullable: true })
	validFrom?: string

	/**
	 * Date until which this address is valid (YYYY-MM-DD) - optional.
	 * @public
	 */
	@Column({ name: 'valid_to', type: 'date', nullable: true })
	validTo?: string

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	/**
	 * Many-to-One relationship with Address.
	 * @public
	 */
	@ManyToOne(() => AddressEntity)
	@JoinColumn({ name: 'address_id' })
	address?: AddressEntity

	/**
	 * Timestamp when record was created (UTC).
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date

	/**
	 * Timestamp when record was last updated (UTC).
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date
}
