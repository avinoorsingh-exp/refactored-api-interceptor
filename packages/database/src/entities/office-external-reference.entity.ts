import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { OfficeEntity } from './office.entity.js'
import { ExternalReferenceEntity } from './external-reference.entity.js'

/**
 * TypeORM entity for OfficeExternalReference junction table.
 * @public
 */
@Entity('office_external_references')
export class OfficeExternalReferenceEntity {
	@PrimaryColumn({ name: 'office_id', type: 'uuid' })
	officeId!: string

	@PrimaryColumn({ name: 'external_reference_id', type: 'uuid' })
	externalReferenceId!: string

	@ManyToOne(() => OfficeEntity)
	@JoinColumn({ name: 'office_id' })
	office?: OfficeEntity

	/**
	 * Many-to-One relationship with ExternalReference.
	 * @public
	 */
	@ManyToOne(() => ExternalReferenceEntity, (ref) => ref.offices)
	@JoinColumn({ name: 'external_reference_id' })
	externalReference?: ExternalReferenceEntity
}
