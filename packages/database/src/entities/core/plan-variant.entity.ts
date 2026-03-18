import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

/**
 * TypeORM entity for PlanVariant table.
 * @public
 */
@Entity({ name: 'plan_variant', schema: 'core' })
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
