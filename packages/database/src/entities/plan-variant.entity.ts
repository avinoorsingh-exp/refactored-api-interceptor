import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

/**
 * TypeORM entity for PlanVariant table.
 * @public
 */
@Entity('plan_variants')
export class PlanVariantEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'payment_settings', type: 'uuid' })
	paymentSettings!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ name: 'default_value', type: 'decimal' })
	defaultValue!: number

	@Column({ name: 'is_default', type: 'boolean' })
	isDefault!: boolean

	@Column({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date
}
