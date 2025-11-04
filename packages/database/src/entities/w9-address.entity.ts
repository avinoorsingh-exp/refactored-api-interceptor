import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { W9Entity } from './w9.entity.js'
import { AddressEntity } from './address.entity.js'

/**
 * TypeORM entity for W9Address junction table.
 * @public
 */
@Entity({ name: 'w9_address', schema: 'core' })
export class W9AddressEntity {
	@PrimaryColumn({ name: 'w9_id', type: 'uuid' })
	w9Id!: string

	@PrimaryColumn({ name: 'address_id', type: 'uuid' })
	addressId!: string

	@ManyToOne(() => W9Entity)
	@JoinColumn({ name: 'w9_id' })
	w9?: W9Entity

	@ManyToOne(() => AddressEntity)
	@JoinColumn({ name: 'address_id' })
	address?: AddressEntity
}
