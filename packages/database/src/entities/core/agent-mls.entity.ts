import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { MLSEntity } from './mls.entity.js'

/**
 * TypeORM entity for AgentMLS join table.
 * Many-to-many relationship between Agent and MLS.
 * Uses agent.id (UUID) as the join column.
 * @public
 */
@Entity({ name: 'agent_mls', schema: 'core' })
export class AgentMLSEntity {
	@PrimaryColumn({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@PrimaryColumn({ name: 'mls_id', type: 'bigint' })
	mlsId!: string

	/**
	 * Legacy database ID for data migration.
	 * @public
	 */
	@Column({ name: 'mxid', type: 'bigint', nullable: true })
	mxid?: string

	@ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	@ManyToOne(() => MLSEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'mls_id' })
	mls?: MLSEntity
}
