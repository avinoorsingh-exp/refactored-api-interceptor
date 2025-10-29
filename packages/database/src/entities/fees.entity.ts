import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for Fees table.
 * @beta
 */
@Entity('fees')
export class FeesEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'boolean' })
	active!: boolean

	@Column({ type: 'decimal', precision: 10, scale: 2 })
	value!: number

	@Column({ name: 'paid_by', type: 'text', nullable: true })
	paidBy?: string

	@Column({ name: 'is_third_party', type: 'boolean', default: false })
	isThirdParty?: boolean
}
