import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

/**
 * TypeORM entity for AgentCompany table.
 * Represents an agent's company/brokerage for commission payments.
 * Database representation of the domain AgentCompany type.
 * @public
 */
@Entity({ name: 'agent_company', schema: 'core' })
export class AgentCompanyEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Legacy system ID for migration compatibility (BigInt).
	 * @public
	 */
	@Column({ name: 'legacy_id', type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Legacy system identifier', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	legacyId!: string

	/**
	 * Company email address.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Company email address' })
	@Filterable()
	@Sortable()
	email!: string

	/**
	 * Registered/legal name of the brokerage.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Company/brokerage name' })
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * Company phone number.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Company phone number' })
	@Filterable()
	phone!: string

	/**
	 * Tax ID (plaintext - for non-sensitive display).
	 * @public
	 */
	@Column({ name: 'tax_id', type: 'text', nullable: true })
	taxId?: string

	/**
	 * Hashed tax ID for secure storage.
	 * @public
	 */
	@Column({ name: 'tax_id_hashed', type: 'text', nullable: true })
	taxIdHashed?: string

	/**
	 * Whether to use SSN instead of EIN.
	 * @public
	 */
	@Column({ name: 'use_ssn', type: 'boolean', default: false })
	@Filterable()
	useSsn!: boolean
}
