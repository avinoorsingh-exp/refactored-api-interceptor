import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	OneToMany,
} from 'typeorm'

/**
 * TypeORM entity for ExternalReference table.
 * Database representation of external system identifiers and mappings.
 * @public
 */
@Entity('external_references')
export class ExternalReferenceEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * External system identifier (e.g., 'SALESFORCE', 'LEGACY_CRM').
	 * @public
	 */
	@Column({ name: 'system_code', type: 'text' })
	systemCode!: string

	/**
	 * Reference key/type in external system.
	 * @public
	 */
	@Column({ name: 'ref_key', type: 'text' })
	refKey!: string

	/**
	 * Reference value/ID in external system.
	 * @public
	 */
	@Column({ name: 'ref_value', type: 'text' })
	refValue!: string

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date

	/**
	 * Last update timestamp.
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date

	/**
	 * One-to-Many relationship with AgentExternalReference.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('AgentExternalReferenceEntity', 'externalReference')
	agents?: unknown[]

	/**
	 * One-to-Many relationship with OfficeExternalReference.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('OfficeExternalReferenceEntity', 'externalReference')
	offices?: unknown[]

	/**
	 * One-to-Many relationship with CompanyExternalReference.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('CompanyExternalReferenceEntity', 'externalReference')
	companies?: unknown[]
}
