import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm'

/**
 * TypeORM entity for Office table.
 * @public
 */
@Entity({ name: 'office', schema: 'core' })
export class OfficeEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'office_id', type: 'bigint' })
	officeId!: string

	@Column({ type: 'text', nullable: true })
	website?: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text' })
	phone!: string

	@Column({ name: 'lifecycle_status', type: 'text' })
	lifecycleStatus!:
		| 'new'
		| 'pending'
		| 'due_diligence'
		| 'pending_payment'
		| 'active'
		| 'withdrawn'
		| 'missing_broker_agent'

	@Column({ name: 'primary_state', type: 'varchar', length: 200 })
	primaryState!: string

	/**
	 * One-to-Many relationship with AgentOffice.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('AgentOfficeEntity', 'office')
	agentOffices?: unknown[]

	/**
	 * One-to-Many relationship with OfficeExternalReference.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('OfficeExternalReferenceEntity', 'office')
	officeExternalReferences?: unknown[]
}
