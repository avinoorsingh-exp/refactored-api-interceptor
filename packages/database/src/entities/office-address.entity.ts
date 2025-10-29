import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { OfficeEntity } from './office.entity.js'
import { AddressEntity } from './address.entity.js'

/**
 * TypeORM entity for OfficeAddress junction table.
 * @public
 */
@Entity('office_addresses')
export class OfficeAddressEntity {
	@PrimaryColumn({ name: 'office_id', type: 'bigint' })
	officeId!: string

	@PrimaryColumn({ name: 'address_id', type: 'uuid' })
	addressId!: string

	@ManyToOne(() => OfficeEntity)
	@JoinColumn({ name: 'office_id' })
	office?: OfficeEntity

	@ManyToOne(() => AddressEntity)
	@JoinColumn({ name: 'address_id' })
	address?: AddressEntity
}
