import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'

/**
 * TypeORM entity for SponsorConfiguration table.
 * @public
 */
@Entity({ name: 'sponsor_configuration', schema: 'core' })
export class SponsorConfigurationEntity {
	@PrimaryColumn({ name: 'agent_id', type: 'bigint' })
	agentId!: string

	@Column({ type: 'uuid' })
	uuid!: string

	@Column({ type: 'integer' })
	buffer!: number

	@Column({ name: 'sponsor_buffer_override', type: 'boolean' })
	sponsorBufferOverride!: boolean

	@Column({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date

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
