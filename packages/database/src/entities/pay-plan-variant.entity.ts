import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { PayPlanEntity } from './pay-plan.entity.js'

/**
 * TypeORM entity for PayPlanVariant junction table.
 * @public
 */
@Entity('pay_plan_variants')
export class PayPlanVariantEntity {
	@PrimaryColumn({ name: 'variant_id', type: 'varchar' })
	variantId!: string

	@PrimaryColumn({ name: 'pay_plan_id', type: 'varchar' })
	payPlanId!: string

	@Column({ type: 'decimal' })
	value!: number

	@ManyToOne(() => PayPlanEntity)
	@JoinColumn({ name: 'pay_plan_id' })
	payPlan?: PayPlanEntity
}
