import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { MLSEntity } from './mls.entity.js'

/**
 * TypeORM entity for AgentMLS join table.
 * Many-to-many relationship between Agent and MLS.
 * @public
 */
@Entity({ name: 'agent_mls', schema: 'core' })
export class AgentMLSEntity {
	@PrimaryColumn({ name: 'agent_id', type: 'bigint' })
	agentId!: string

	@PrimaryColumn({ name: 'mls_id', type: 'bigint' })
	mlsId!: string

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	@ManyToOne(() => MLSEntity)
	@JoinColumn({ name: 'mls_id' })
	mls?: MLSEntity
}
