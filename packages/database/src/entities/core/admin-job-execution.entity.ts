import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';

/**
 * Job execution status enum values.
 * @public
 */
export enum AdminJobExecutionStatus {
	RUNNING = 'RUNNING',
	SUCCESS = 'SUCCESS',
	FAILED = 'FAILED',
}

/**
 * TypeORM entity for admin_job_execution table.
 * Stores execution history for scheduled jobs.
 * 
 * @public
 */
@Entity({ name: 'admin_job_execution', schema: 'core' })
@Index('idx_admin_job_execution_job_name', ['jobName'])
@Index('idx_admin_job_execution_status', ['status'])
@Index('idx_admin_job_execution_started_at', ['startedAt'])
export class AdminJobExecutionEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/**
	 * Job name (foreign key to admin_job.name).
	 * @public
	 */
	@Column({ name: 'job_name', type: 'text' })
	jobName!: string;

	/**
	 * Execution status.
	 * @public
	 */
	@Column({ type: 'text' })
	status!: AdminJobExecutionStatus;

	/**
	 * Execution start timestamp.
	 * @public
	 */
	@Column({ name: 'started_at', type: 'timestamp with time zone' })
	startedAt!: Date;

	/**
	 * Last activity timestamp (updated during execution when logs/queries occur).
	 * Optional field for tracking execution activity, used for orphaned execution detection.
	 * @public
	 */
	@Column({ name: 'last_activity_at', type: 'timestamp with time zone', nullable: true })
	lastActivityAt?: Date | null;

	/**
	 * Execution finish timestamp.
	 * @public
	 */
	@Column({ name: 'finished_at', type: 'timestamp with time zone', nullable: true })
	finishedAt?: Date | null;

	/**
	 * Execution duration in milliseconds.
	 * @public
	 */
	@Column({ name: 'duration_ms', type: 'integer', nullable: true })
	durationMs?: number | null;

	/**
	 * Error message if execution failed.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	error?: string | null;

	/**
	 * Execution log/output containing details of what the job did.
	 * Stored as JSON string for structured data or plain text for logs.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	log?: string | null;

	/**
	 * Creation timestamp (same as startedAt).
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	/**
	 * Related job entity.
	 * @public
	 */
	@ManyToOne('AdminJobEntity', 'executions', { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'job_name', referencedColumnName: 'name' })
	job?: any;
}

