import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToOne,
	JoinColumn,
	OneToMany,
} from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { PayPlanEntity } from './pay-plan.entity.js'

/**
 * TypeORM entity for PaymentSettings table.
 * Stores payment settings for agents, including bank and broker details.
 * @public
 */
@Entity({ name: 'payment_settings', schema: 'core' })
export class PaymentSettingsEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	@Column({ name: 'pay_plan_id', type: 'uuid', nullable: true })
	payPlanId?: string

	@Column({ name: 'cap_reset_date', type: 'timestamp with time zone' })
	capResetDate!: Date

	@Column({ name: 'split_check', type: 'boolean' })
	splitCheck!: boolean

	@Column({ name: 'cap_reset_date_changed_by_user', type: 'boolean' })
	capResetDateChangedByUser!: boolean

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	@ManyToOne(() => PayPlanEntity)
	@JoinColumn({ name: 'pay_plan_id' })
	payPlan?: PayPlanEntity

	/**
	 * One-to-Many relationship with PaymentSettingsVariant.
	 * Uses string name to avoid circular dependency at module load time.
	 * @public
	 */
	@OneToMany('PaymentSettingsVariantEntity', 'paymentSettings')
	paymentSettingsVariants?: unknown[]
}
