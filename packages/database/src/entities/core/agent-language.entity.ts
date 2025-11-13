import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { LanguageEntity } from './language.entity.js'

/**
 * TypeORM entity for AgentLanguage join table.
 * Many-to-many relationship between Agent and Language.
 * @public
 */
@Entity({ name: 'agent_language', schema: 'core' })
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
