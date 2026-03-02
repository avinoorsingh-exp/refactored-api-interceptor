import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { OfficeEntity } from './office.entity.js'
import { ExternalReferenceEntity } from './external-reference.entity.js'

/**
 * TypeORM entity for OfficeExternalReference junction table.
 * @public
 */
@Entity({ name: 'office_external_reference', schema: 'core' })
export class OfficeExternalReferenceEntity {
	@PrimaryColumn({ name: 'office_id', type: 'uuid' })
	officeId!: string

	@PrimaryColumn({ name: 'external_reference_id', type: 'uuid' })
	externalReferenceId!: string

	@ManyToOne(() => OfficeEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'office_id' })
	office?: OfficeEntity

	@ManyToOne(() => ExternalReferenceEntity, (ref) => ref.offices, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'external_reference_id' })
	externalReference?: ExternalReferenceEntity
}
