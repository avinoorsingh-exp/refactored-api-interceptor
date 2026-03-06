import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	OneToMany,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

/**
 * W9 status enum values.
 * @public
 */
export type W9Status = 'Active' | 'Pending Revision' | 'Inactive'

/**
 * W9 tax classification enum values.
 * @public
 */
export type W9TaxClassification =
	| 'Individual/sole proprietor'
	| 'C Corp'
	| 'S Corp'
	| 'Partnership'
	| 'Trust/estate'
	| 'Limited liability company (LLC)'
	| 'Other'

/**
 * W9 LLC tax classification enum values.
 * @public
 */
export type W9LlcTaxClassification = 'C Corp' | 'S Corp' | 'Partnership'

/**
 * TypeORM entity for W9 table.
 * Stores IRS Form W-9 information for tax reporting.
 * @public
 */
@Entity({ name: 'w9', schema: 'core' })
export class W9Entity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Searchable({ weight: 3, behavior: 'exact', description: 'Unique W9 identifier (UUID)' })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * W9 status (Active, Pending Revision, Inactive).
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 7, behavior: 'exact', description: 'W9 status (Active, Pending Revision, Inactive)' })
	@Filterable()
	@Sortable()
	status!: W9Status

	/**
	 * Account number.
	 * @public
	 */
	@Column({ name: 'account_number', type: 'text', nullable: true })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Account number' })
	@Filterable()
	@Sortable()
	accountNumber?: string

	/**
	 * Collection source.
	 * @public
	 */
	@Column({ name: 'collection_source', type: 'text', nullable: true })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Collection source' })
	@Filterable()
	@Sortable()
	collectionSource?: string

	/**
	 * Tax reporting name.
	 * @public
	 */
	@Column({ name: 'tax_reporting_name', type: 'text', nullable: true })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Tax reporting name' })
	@Filterable()
	@Sortable()
	taxReportingName?: string

	/**
	 * Tax classification.
	 * @public
	 */
	@Column({ name: 'tax_classification', type: 'text', nullable: true })
	@Searchable({ weight: 6, behavior: 'exact', description: 'Tax classification (Individual, C Corp, S Corp, etc.)' })
	@Filterable()
	@Sortable()
	taxClassification?: W9TaxClassification

	/**
	 * LLC tax classification (if applicable).
	 * @public
	 */
	@Column({ name: 'llc_tax_classification', type: 'text', nullable: true })
	@Searchable({ weight: 5, behavior: 'exact', description: 'LLC tax classification (C Corp, S Corp, Partnership)' })
	@Filterable()
	@Sortable()
	llcTaxClassification?: W9LlcTaxClassification

	/**
	 * Disregarded entity name.
	 * @public
	 */
	@Column({ name: 'disregarded_entity_name', type: 'text', nullable: true })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Disregarded entity name' })
	@Filterable()
	@Sortable()
	disregardedEntityName?: string

	/**
	 * Exempt payee code.
	 * @public
	 */
	@Column({ name: 'exempt_payee_code', type: 'text', nullable: true })
	@Searchable({ weight: 3, behavior: 'exact', description: 'Exempt payee code' })
	@Filterable()
	@Sortable()
	exemptPayeeCode?: string

	/**
	 * Document ID.
	 * @public
	 */
	@Column({ name: 'document_id', type: 'text', nullable: true })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Document ID' })
	@Filterable()
	@Sortable()
	documentId?: string

	/**
	 * Document URL.
	 * @public
	 */
	@Column({ name: 'document_url', type: 'text', nullable: true })
	@Searchable({ weight: 3, behavior: 'partial', description: 'Document URL' })
	@Filterable()
	@Sortable()
	documentUrl?: string

	/**
	 * Total submission attempts.
	 * @public
	 */
	@Column({ name: 'total_submission_attempts', type: 'integer', default: 0 })
	@Searchable({ type: 'integer', weight: 2, behavior: 'exact', description: 'Total submission attempts', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	totalSubmissionAttempts!: number

	/**
	 * FATCA reporting codes.
	 * @public
	 */
	@Column({ name: 'fatca_reporting_codes', type: 'text', nullable: true })
	@Searchable({ weight: 3, behavior: 'partial', description: 'FATCA reporting codes' })
	@Filterable()
	@Sortable()
	fatcaReportingCodes?: string

	/**
	 * Compliancely result.
	 * @public
	 */
	@Column({ name: 'compliancely_result', type: 'text', nullable: true })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Compliancely result' })
	@Filterable()
	@Sortable()
	compliancelyResult?: string

	/**
	 * Compliancely tax reporting name.
	 * @public
	 */
	@Column({ name: 'compliancely_tax_reporting_name', type: 'text', nullable: true })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Compliancely tax reporting name' })
	@Filterable()
	@Sortable()
	compliancelyTaxReportingName?: string

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * One-to-Many relationship with W9Address.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('W9AddressEntity', 'w9')
	w9Addresses?: unknown[]
}
