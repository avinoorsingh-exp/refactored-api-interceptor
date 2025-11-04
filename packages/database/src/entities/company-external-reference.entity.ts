import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { CompanyEntity } from './company.entity.js'
import { ExternalReferenceEntity } from './external-reference.entity.js'

/**
 * TypeORM entity for CompanyExternalReference junction table.
 * Links Company entities with ExternalReference entities (many-to-many).
 * @public
 */
@Entity({ name: 'company_external_reference', schema: 'core' })
export class CompanyExternalReferenceEntity {
	/**
	 * Foreign key to Company (composite PK).
	 * @public
	 */
	@PrimaryColumn({ name: 'company_id', type: 'uuid' })
	companyId!: string

	/**
	 * Foreign key to ExternalReference (composite PK).
	 * @public
	 */
	@PrimaryColumn({ name: 'external_reference_id', type: 'uuid' })
	externalReferenceId!: string

	/**
	 * Many-to-One relationship with Company.
	 * @public
	 */
	@ManyToOne(() => CompanyEntity, { cascade: true, eager: false, nullable: true })
	@JoinColumn({ name: 'company_id' })
	company?: CompanyEntity

	/**
	 * Many-to-One relationship with ExternalReference.
	 * @public
	 */
	@ManyToOne(() => ExternalReferenceEntity, (ref) => ref.companies, { cascade: true , eager: false})
	@JoinColumn({ name: 'external_reference_id' })
	externalReference?: ExternalReferenceEntity
}
