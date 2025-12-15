import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	JoinColumn,
	OneToMany,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { LineOfBusinessEntity } from './line-of-business.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

// Forward declaration for circular dependency
import type { StateEntity } from './state.entity.js'

/**
 * License type enum values.
 * @public
 */
export type LicenseType = 'Provisional Broker' | 'Broker' | 'BIC Eligible'

/**
 * TypeORM entity for License table.
 * Stores professional licensing information for agents.
 * @public
 */
@Entity({ name: 'license', schema: 'core' })
export class LicenseEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Searchable({ weight: 3, behavior: 'exact', description: 'Unique license identifier (UUID)' })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * License expiration date.
	 * @public
	 */
	@Column({ name: 'expiration_date', type: 'timestamp with time zone', nullable: true })
	@Searchable({ type: 'date', weight: 5, behavior: 'range', description: 'License expiration date' })
	@Filterable()
	@Sortable()
	expirationDate?: Date

	/**
	 * Whether this is the primary license.
	 * @public
	 */
	@Column({ name: 'is_primary', type: 'boolean' })
	@Searchable({ type: 'boolean', weight: 3, behavior: 'exact', description: 'Whether this is the primary license' })
	@Filterable()
	@Sortable()
	isPrimary!: boolean

	/**
	 * License type (Provisional Broker, Broker, BIC Eligible).
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 7, behavior: 'exact', description: 'License type (Provisional Broker, Broker, BIC Eligible)' })
	@Filterable()
	@Sortable()
	type!: LicenseType

	/**
	 * First name on the license.
	 * @public
	 */
	@Column({ name: 'first_name', type: 'text' })
	@Searchable({ weight: 8, behavior: 'partial', description: 'First name on the license' })
	@Filterable()
	@Sortable()
	firstName!: string

	/**
	 * Middle name on the license.
	 * @public
	 */
	@Column({ name: 'middle_name', type: 'text', nullable: true })
	@Searchable({ weight: 4, behavior: 'partial', description: 'Middle name on the license' })
	@Filterable()
	@Sortable()
	middleName?: string

	/**
	 * Last name on the license.
	 * @public
	 */
	@Column({ name: 'last_name', type: 'text' })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Last name on the license' })
	@Filterable()
	@Sortable()
	lastName!: string

	/**
	 * Name suffix on the license.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 2, behavior: 'partial', description: 'Name suffix on the license' })
	@Filterable()
	@Sortable()
	suffix?: string

	/**
	 * License number.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 10, behavior: 'exact', description: 'License number' })
	@Filterable()
	@Sortable()
	number!: string

	/**
	 * Foreign key to LineOfBusiness (BigInt).
	 * @public
	 */
	@Column({ name: 'line_of_business_id', type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Line of business ID', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	lineOfBusinessId!: string

	/**
	 * Foreign key to State (UUID).
	 * @public
	 */
	@Column({ name: 'state_id', type: 'uuid' })
	@Searchable({ weight: 3, behavior: 'exact', description: 'State ID reference (UUID)' })
	@Filterable()
	@Sortable()
	stateId!: string

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * Many-to-One relationship with LineOfBusiness.
	 * @public
	 */
	@ManyToOne(() => LineOfBusinessEntity)
	@JoinColumn({ name: 'line_of_business_id' })
	lineOfBusiness?: LineOfBusinessEntity

	/**
	 * Many-to-One relationship with State.
	 * @public
	 */
	@ManyToOne('StateEntity')
	@JoinColumn({ name: 'state_id' })
	state?: StateEntity

	/**
	 * One-to-Many relationship with LicenseEvent.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('LicenseEventEntity', 'license')
	licenseEvents?: unknown[]
}
