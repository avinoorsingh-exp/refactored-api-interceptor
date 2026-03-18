import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { ExternalReferenceEntity } from './external-reference.entity.js'

/**
 * TypeORM entity for AgentExternalReference join table.
 * Many-to-many relationship between Agent and ExternalReference.
 * @public
 */
@Entity({ name: 'agent_external_reference', schema: 'core' })
export class AgentExternalReferenceEntity {
	@PrimaryColumn({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@PrimaryColumn({ name: 'external_reference_id', type: 'uuid' })
	externalReferenceId!: string

	@ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	@ManyToOne(() => ExternalReferenceEntity, (ref) => ref.agents, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'external_reference_id' })
	externalReference?: ExternalReferenceEntity
}
