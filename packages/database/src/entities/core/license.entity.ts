import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	JoinColumn,
	OneToMany,
} from 'typeorm'
import { LineOfBusinessEntity } from './line-of-business.entity.js'

/**
 * TypeORM entity for License table.
 * Stores professional licensing information for agents.
 * @public
 */
@Entity({ name: 'license', schema: 'core' })
export class LicenseEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'expiration_date', type: 'date', nullable: true })
	expirationDate?: string

	@Column({ name: 'is_primary', type: 'boolean' })
	isPrimary!: boolean

	@Column({ type: 'varchar', length: 50 })
	type!: 'Provisional Broker' | 'Broker' | 'BIC Eligible'

	@Column({ name: 'first_name', type: 'text' })
	firstName!: string

	@Column({ name: 'middle_name', type: 'text', nullable: true })
	middleName?: string

	@Column({ name: 'last_name', type: 'text' })
	lastName!: string

	@Column({ type: 'text', nullable: true })
	suffix?: string

	@Column({ type: 'text' })
	number!: string

	@Column({ name: 'line_of_business_id', type: 'bigint' })
	lineOfBusinessId!: string

	@Column({ name: 'state_id', type: 'uuid' })
	stateId!: string

	@ManyToOne(() => LineOfBusinessEntity)
	@JoinColumn({ name: 'line_of_business_id' })
	lineOfBusiness?: LineOfBusinessEntity

	/**
	 * One-to-many relationship with LicenseEvent.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('LicenseEventEntity', 'license')
	licenseEvents?: unknown[]
}
