import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'

/**
 * TypeORM entity for SponsorConfiguration table.
 * @public
 */
@Entity({ name: 'sponsor_configuration', schema: 'core' })
export class SponsorConfigurationEntity {
	/**
	 * Primary key / Foreign key to Agent (UUID).
	 * @public
	 */
	@PrimaryColumn({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@Column({ type: 'uuid' })
	uuid!: string

	@Column({ type: 'integer' })
	buffer!: number

	@Column({ name: 'sponsor_buffer_override', type: 'boolean' })
	sponsorBufferOverride!: boolean

	@Column({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

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
