import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { PaymentSettingsEntity } from './payment-settings.entity.js'

/**
 * TypeORM entity for PaymentSettingsVariant table.
 * @public
 */
@Entity('payment_settings_variants')
export class PaymentSettingsVariantEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'payment_settings', type: 'uuid' })
	paymentSettingsId!: string

	@Column({ name: 'custom_name', type: 'text' })
	customName!: string

	@Column({ type: 'decimal' })
	value!: number

	@Column({ name: 'start_date', type: 'timestamp with time zone' })
	startDate!: Date

	@Column({ name: 'end_date', type: 'timestamp with time zone' })
	endDate!: Date

	@Column({ type: 'text' })
	type!: 'concession' | 'fees'

	@Column({ name: 'last_modified', type: 'timestamp with time zone' })
	lastModified!: Date

	@ManyToOne(() => PaymentSettingsEntity)
	@JoinColumn({ name: 'payment_settings' })
	paymentSettings?: PaymentSettingsEntity
}
