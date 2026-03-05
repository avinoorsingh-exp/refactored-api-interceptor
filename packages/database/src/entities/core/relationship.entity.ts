import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'

/**
 * TypeORM entity for Relationship table.
 * @public
 */
@Entity({ name: 'relationship', schema: 'core' })
export class RelationshipEntity {
	@PrimaryColumn({ name: 'subject_agent_id', type: 'uuid' })
	subjectAgentId!: string

	@PrimaryColumn({ name: 'object_agent_id', type: 'uuid' })
	objectAgentId!: string

	@Column({ type: 'text' })
	type!: 'sponsor_primary' | 'sponsor_successor' | 'sponsor_adaptive' | 'mentor_successor'

	@Column({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date

	@Column({ type: 'timestamp with time zone' })
	created!: Date

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'subject_agent_id' })
	subjectAgent?: AgentEntity

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'object_agent_id' })
	objectAgent?: AgentEntity

	toJSON(): Record<string, any> {
		const obj: Record<string, any> = {}
		for (const key in this) {
			if (Object.prototype.hasOwnProperty.call(this, key) && !key.includes('_')) {
				obj[key] = this[key]
			}
		}
		return obj
	}
}
