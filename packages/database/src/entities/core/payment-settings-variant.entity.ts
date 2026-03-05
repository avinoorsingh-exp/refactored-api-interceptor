import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { PaymentSettingsEntity } from './payment-settings.entity.js'

/**
 * TypeORM entity for PaymentSettingsVariant table.
 * @public
 */
@Entity({ name: 'payment_settings_variant', schema: 'core' })
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

	toJSON(): Record<string, any> {
		const obj: Record<string, any> = {}
		for (const key in this) {
			if (Object.prototype.hasOwnProperty.call(this, key) && !key.includes('_')) {
				obj[key] = this[key]
			}
		}
		return obj
	}
}
