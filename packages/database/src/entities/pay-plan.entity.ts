import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm'

/**
 * TypeORM entity for PayPlan table.
 * @public
 */
@Entity('pay_plans')
export class PayPlanEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'boolean' })
	active!: boolean

	@Column({ name: 'agent_percentage', type: 'decimal' })
	agentPercentage!: number

	@Column({ type: 'decimal' })
	cap!: number

	/**
	 * One-to-Many relationship with PayPlanVariant.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('PayPlanVariantEntity', 'payPlan')
	payPlanVariants?: unknown[]

	/**
	 * One-to-Many relationship with PaymentSettings.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('PaymentSettingsEntity', 'payPlan')
	paymentSettings?: unknown[]
}
