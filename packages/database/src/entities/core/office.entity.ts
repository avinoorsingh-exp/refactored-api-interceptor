import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	OneToMany,
	ManyToOne,
	ManyToMany,
	JoinColumn,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'
import { CompanyEntity } from './company.entity.js'
import { AgentEntity } from './agent.entity.js'

/**
 * Lifecycle status values for Office.
 * @public
 */
export type OfficeLifecycleStatus =
	| 'new'
	| 'pending_due_diligence'
	| 'pending_payment'
	| 'active'
	| 'withdrawn'
	| 'missing_broker_agent'

/**
 * TypeORM entity for Office table.
 * @public
 */
@Entity({ name: 'office', schema: 'core' })
export class OfficeEntity extends AuditableEntity {
	/**
	 * Primary key (bigint).
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique office identifier', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Office website URL.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 4, behavior: 'partial', description: 'Office website URL' })
	@Filterable()
	@Sortable()
	website?: string

	/**
	 * Office name.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Office display name' })
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * Office phone number.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Office phone number' })
	@Filterable()
	@Sortable()
	phone!: string

	/**
	 * Office lifecycle status.
	 * @public
	 */
	@Column({ name: 'lifecycle_status', type: 'text' })
	@Searchable({ weight: 6, behavior: 'exact', description: 'Office lifecycle status (new, active, pending_*, withdrawn, missing_broker_agent)' })
	@Filterable()
	@Sortable()
	lifecycleStatus!: OfficeLifecycleStatus

	/**
	 * Primary state (e.g., "California", "TX").
	 * @public
	 */
	@Column({ name: 'primary_state', type: 'varchar', length: 200 })
	@Searchable({ weight: 6, behavior: 'partial', description: 'Primary state of operation' })
	@Filterable()
	@Sortable()
	primaryState!: string

	/**
	 * Foreign key to Company.
	 * @public
	 */
	@Column({ name: 'company_id', type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Parent company ID', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	companyId!: string

	/**
	 * Many-to-One relationship with Company.
	 * @public
	 */
	@ManyToOne(() => CompanyEntity, { eager: false })
	@JoinColumn({ name: 'company_id' })
	company?: CompanyEntity

	/**
	 * One-to-Many relationship with AgentOffice.
	 * Use this to access junction metadata like isPrimary.
	 * @public
	 */
	@OneToMany('AgentOfficeEntity', 'office')
	agentOffice?: unknown[]

	/**
	 * Many-to-Many relationship with Agent.
	 * Direct access to agents (hides junction table).
	 * @public
	 */
	@ManyToMany(() => AgentEntity, (agent) => agent.office)
	agents?: AgentEntity[]

	/**
	 * One-to-Many relationship with OfficeExternalReference.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('OfficeExternalReferenceEntity', 'office')
	officeExternalReferences?: unknown[]
}
