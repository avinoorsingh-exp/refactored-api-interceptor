import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for Approval table.
 * @beta
 */
@Entity({ name: 'approval', schema: 'core' })
export class ApprovalEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	approvalId!: string

	@Column({ name: 'approval_state', type: 'text' })
	approvalState!: string

	@Column({ name: 'decision_date', type: 'timestamp with time zone', nullable: true })
	decisionDate?: Date

	@Column({ type: 'integer', nullable: true })
	counters?: number

	@Column({ type: 'text', nullable: true })
	template?: string

	@Column({ type: 'text', nullable: true })
	note?: string

	@Column({ type: 'boolean', default: false })
	prerequisite?: boolean
}
