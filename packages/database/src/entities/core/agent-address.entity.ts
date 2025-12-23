import {
	Entity,
	Column,
	PrimaryColumn,
	ManyToOne,
	JoinColumn,
} from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { AddressEntity } from './address.entity.js'

/**
 * TypeORM entity for AgentAddress join table.
 * Many-to-many relationship between Agent and Address.
 * Composite primary key: (agent_id, address_id).
 * @public
 */
@Entity({ name: 'agent_address', schema: 'core' })
export class AgentAddressEntity {
	/**
	 * Foreign key to Agent (part of composite PK).
	 * @public
	 */
	@PrimaryColumn({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	/**
	 * Foreign key to Address (part of composite PK).
	 * Stored as string in TypeScript for JSON serialization compatibility.
	 * @public
	 */
	@PrimaryColumn({ name: 'address_id', type: 'bigint' })
	addressId!: string

	/**
	 * Whether this is the primary address for the agent.
	 * @public
	 */
	@Column({ name: 'is_primary', type: 'boolean', default: false })
	isPrimary!: boolean

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
}
