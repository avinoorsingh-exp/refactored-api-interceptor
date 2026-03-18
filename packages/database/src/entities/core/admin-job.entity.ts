import {
	Entity,
	Column,
	PrimaryColumn,
	CreateDateColumn,
	UpdateDateColumn,
	OneToMany,
} from 'typeorm';

/**
 * TypeORM entity for admin_job table.
 * Stores scheduled job metadata and configuration.
 * 
 * @public
 */
@Entity({ name: 'admin_job', schema: 'core' })
export class AdminJobEntity {
	/**
	 * Primary key (job name).
	 * @public
	 */
	@PrimaryColumn({ type: 'text' })
	name!: string;

	/**
	 * Job description.
	 * @public
	 */
	@Column({ type: 'text' })
	description!: string;

	/**
	 * Cron expression for scheduling.
	 * Null for manual-only jobs (no automatic scheduling).
	 * @public
	 */
	@Column({ name: 'cron_expression', type: 'text', nullable: true })
	cronExpression?: string | null;

	/**
	 * Whether the job is enabled.
	 * @public
	 */
	@Column({ type: 'boolean', default: true })
	enabled!: boolean;

	/**
	 * If true, job will run once automatically on app startup (if not already run).
	 * Only applies to manual jobs (cron = null).
	 * @public
	 */
	@Column({ name: 'run_on_startup', type: 'boolean', default: false })
	runOnStartup!: boolean;

	/**
	 * Timestamp of last execution.
	 * @public
	 */
	@Column({ name: 'last_run_at', type: 'timestamp with time zone', nullable: true })
	lastRunAt?: Date | null;

	/**
	 * Timestamp of next scheduled execution.
	 * @public
	 */
	@Column({ name: 'next_run_at', type: 'timestamp with time zone', nullable: true })
	nextRunAt?: Date | null;

	/**
	 * Total number of executions.
	 * @public
	 */
	@Column({ name: 'run_count', type: 'integer', default: 0 })
	runCount!: number;

	/**
	 * Total number of failed executions.
	 * @public
	 */
	@Column({ name: 'failure_count', type: 'integer', default: 0 })
	failureCount!: number;

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	/**
	 * Last update timestamp.
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;

	/**
	 * Execution history records.
	 * @public
	 */
	@OneToMany('AdminJobExecutionEntity', 'job')
	executions?: any[];
}

