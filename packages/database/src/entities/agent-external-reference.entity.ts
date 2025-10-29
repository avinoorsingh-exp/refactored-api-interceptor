import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { ExternalReferenceEntity } from './external-reference.entity.js'

/**
 * TypeORM entity for AgentExternalReference junction table.
 * @public
 */
@Entity('agent_external_references')
export class AgentExternalReferenceEntity {
	@PrimaryColumn({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@PrimaryColumn({ name: 'external_reference_id', type: 'uuid' })
	externalReferenceId!: string

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	/**
	 * Many-to-One relationship with ExternalReference.
	 * @public
	 */
	@ManyToOne(() => ExternalReferenceEntity, (ref) => ref.agents)
	@JoinColumn({ name: 'external_reference_id' })
	externalReference?: ExternalReferenceEntity
}
