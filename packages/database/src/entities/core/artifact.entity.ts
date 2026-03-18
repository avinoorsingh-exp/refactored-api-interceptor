import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	JoinColumn,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'

/**
 * Artifact type enum values.
 * @public
 */
export type ArtifactType = 'Document' | 'Image' | 'etc'

/**
 * TypeORM entity for Artifact table.
 * Stores documents, images, and other files associated with agents.
 * @public
 */
@Entity({ name: 'artifact', schema: 'core' })
export class ArtifactEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Searchable({ weight: 3, behavior: 'exact', description: 'Unique artifact identifier (UUID)' })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Artifact type (Document, Image, etc).
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 5, behavior: 'exact', description: 'Artifact type (Document, Image, etc)' })
	@Filterable()
	@Sortable()
	type!: ArtifactType

	/**
	 * Foreign key to Agent (UUID).
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Agent ID reference (UUID)' })
	@Filterable()
	@Sortable()
	agentId!: string

	/**
	 * URL to the artifact resource.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 3, behavior: 'partial', description: 'Artifact URL' })
	@Filterable()
	@Sortable()
	url?: string

	/**
	 * Many-to-One relationship with Agent via agentId (UUID).
	 * References Agent.id (UUID primary key).
	 * @public
	 */
	@ManyToOne('AgentEntity')
	@JoinColumn({ name: 'agent_id' })
	agent?: unknown
}
