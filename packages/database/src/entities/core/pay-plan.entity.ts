import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'
import type { PayPlanVariantEntity } from './pay-plan-variant.entity.js'

/**
 * TypeORM entity for PayPlan table.
 * @public
 */
@Entity({ name: 'pay_plan', schema: 'core' })
export class PayPlanEntity extends AuditableEntity {
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	@Sortable()
	id!: string

	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Pay plan display name' })
	@Filterable()
	@Sortable()
	name!: string

	@Column({ type: 'boolean' })
	@Searchable({ weight: 3, behavior: 'exact', description: 'Pay plan display status' })
	@Filterable()
	@Sortable()
	active!: boolean

	@Column({ name: 'agent_percentage', type: 'decimal', precision: 28, scale: 8 })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Pay plan display agent percentage' })
	@Filterable()
	@Sortable()
	agentPercentage!: number

	@Column({ type: 'decimal', precision: 28, scale: 8 })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Pay plan display cap amount' })
	@Filterable()
	@Sortable()
	cap!: number

	/**
	 * One-to-Many relationship with PayPlanVariant.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('PayPlanVariantEntity', 'payPlan')
	payPlanVariants?: PayPlanVariantEntity[]

	/**
	 * One-to-Many relationship with PaymentSettings.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('PaymentSettingsEntity', 'payPlan')
	paymentSettings?: unknown[]
}
