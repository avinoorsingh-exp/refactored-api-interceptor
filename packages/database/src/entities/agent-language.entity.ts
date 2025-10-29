import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { LanguageEntity } from './language.entity.js'

/**
 * TypeORM entity for AgentLanguage junction table.
 * @public
 */
@Entity('agent_languages')
export class AgentLanguageEntity {
	@PrimaryColumn({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@PrimaryColumn({ name: 'language_id', type: 'uuid' })
	languageId!: string

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	@ManyToOne(() => LanguageEntity)
	@JoinColumn({ name: 'language_id' })
	language?: LanguageEntity
}
