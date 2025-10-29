import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'

/**
 * TypeORM entity for ActiveLocation table.
 * @public
 */
@Entity('active_locations')
export class ActiveLocationEntity {
	@PrimaryColumn({ name: 'name', type: 'text' })
	name!: string

	@PrimaryColumn({ name: 'agent_id', type: 'bigint' })
	agentId!: string

	@Column({ name: 'postal_code', type: 'text' })
	postalCode!: string

	@Column({ type: 'text' })
	city!: string

	@Column({ name: 'is_primary', type: 'boolean' })
	isPrimary!: boolean

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity
}
