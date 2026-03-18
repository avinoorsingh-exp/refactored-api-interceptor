import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'

/**
 * TypeORM entity for ActiveLocation table.
 * @public
 */
@Entity({ name: 'active_location', schema: 'core' })
export class ActiveLocationEntity {
	@PrimaryColumn({ name: 'name', type: 'text' })
	name!: string

	/**
	 * Foreign key to Agent (UUID).
	 * @public
	 */
	@PrimaryColumn({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@Column({ name: 'postal_code', type: 'text' })
	postalCode!: string

	@Column({ type: 'text' })
	city!: string

	@Column({ name: 'is_primary', type: 'boolean' })
	isPrimary!: boolean

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity
}
