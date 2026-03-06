import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { CompanyEntity } from './company.entity.js'
import { ExternalReferenceEntity } from './external-reference.entity.js'

/**
 * TypeORM entity for CompanyExternalReference junction table.
 * @public
 */
@Entity({ name: 'company_external_reference', schema: 'core' })
export class CompanyExternalReferenceEntity {
	@PrimaryColumn({ name: 'company_id', type: 'bigint' })
	companyId!: string

	@PrimaryColumn({ name: 'external_reference_id', type: 'uuid' })
	externalReferenceId!: string

	@ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'company_id' })
	company?: CompanyEntity

	@ManyToOne(() => ExternalReferenceEntity, (ref) => ref.companies, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'external_reference_id' })
	externalReference?: ExternalReferenceEntity
}
