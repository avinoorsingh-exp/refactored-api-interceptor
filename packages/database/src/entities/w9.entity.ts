import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	OneToMany,
} from 'typeorm'

/**
 * TypeORM entity for W9 table.
 * @public
 */
@Entity('w9')
export class W9Entity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	tin!: string

	@Column({ name: 'legal_name', type: 'text' })
	legalName!: string

	@Column({ name: 'business_name', type: 'text', nullable: true })
	businessName?: string

	@Column({ name: 'federal_tax_classification', type: 'text' })
	federalTaxClassification!: string

	@Column({
		name: 'federal_tax_classification_other',
		type: 'text',
		nullable: true,
	})
	federalTaxClassificationOther?: string

	@Column({ name: 'exempt_payee_code', type: 'text', nullable: true })
	exemptPayeeCode?: string

	@Column({
		name: 'exemption_from_fatca_reporting_code',
		type: 'text',
		nullable: true,
	})
	exemptionFromFatcaReportingCode?: string

	@Column({ name: 'signature_date', type: 'timestamp with time zone' })
	signatureDate!: Date

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date

	/**
	 * One-to-many relationship with W9Address.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('W9AddressEntity', 'w9')
	w9Addresses?: unknown[]
}
