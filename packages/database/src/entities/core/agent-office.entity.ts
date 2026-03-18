import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { OfficeEntity } from './office.entity.js'

/**
 * TypeORM entity for AgentOffice join table.
 * Many-to-many relationship between Agent and Office.
 * @public
 */
@Entity({ name: 'agent_office', schema: 'core' })
export class AgentOfficeEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'is_primary', type: 'boolean' })
	isPrimary!: boolean

	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@Column({ name: 'office_id', type: 'bigint' })
	officeId!: string

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	@ManyToOne(() => OfficeEntity)
	@JoinColumn({ name: 'office_id' })
	office?: OfficeEntity
}
