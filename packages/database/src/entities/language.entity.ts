import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'

/**
 * TypeORM entity for Language table.
 * @public
 */
@Entity({ name: 'language', schema: 'core' })
export class LanguageEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text' })
	code!: 'en-GB' | 'ar-SA'

	@Column({ type: 'boolean' })
	supported!: boolean

	/**
	 * One-to-many relationship with AgentLanguage.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('AgentLanguageEntity', 'language')
	agentLanguages?: unknown[]
}
