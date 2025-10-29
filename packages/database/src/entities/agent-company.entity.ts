import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'

/**
 * TypeORM entity for AgentCompany table.
 * Database representation of the domain AgentCompany type.
 * @public
 */
@Entity('agent_companies')
export class AgentCompanyEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * Legacy system ID for migration compatibility.
	 * @public
	 */
	@Column({ name: 'legacy_id', type: 'uuid' })
	legacyId!: string

	/**
	 * Company email address.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	email!: string

	/**
	 * Registered/legal name of the brokerage.
	 * @public
	 */
	@Column({ type: 'text' })
	name!: string

	/**
	 * Company phone number.
	 * @public
	 */
	@Column({ type: 'text' })
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
	useSsn!: boolean

	/**
	 * Timestamp when record was created (UTC).
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date

	/**
	 * Timestamp when record was last updated (UTC).
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date
}
