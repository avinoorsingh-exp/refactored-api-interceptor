/**
 * Execution result returned by job handlers.
 * Contains details about what the job did during execution.
 */
export interface JobExecutionResult {
	/**
	 * Execution summary/result as JSON string.
	 * Will be merged into the execution logs for UI display.
	 * Use this for final results/summaries, not detailed logs.
	 */
	log?: string;
}

/**
 * Log capture service interface for job handlers.
 * Allows jobs to log messages and queries during execution.
 */
export interface JobLogCapture {
	/**
	 * Log a message entry.
	 */
	log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: Record<string, unknown>): void;

	/**
	 * Log a database query.
	 */
	logQuery(sql: string, parameters?: unknown[], duration?: number): void;

	/**
	 * Log execution result/summary.
	 */
	logResult(data: Record<string, unknown>): void;
}

/**
 * Interface for scheduled job handlers.
 * Jobs implement this interface to register with AdminJobService.
 * 
 * @public
 */
export interface AdminJobHandler {
	/**
	 * Unique job name.
	 */
	name: string;

	/**
	 * Job description.
	 */
	description: string;

	/**
	 * Cron expression for scheduling.
	 * Use null for manual-only jobs (no automatic scheduling).
	 */
	cron: string | null;

	/**
	 * Set log capture service (optional).
	 * Called by AdminJobService before execution to enable log capture.
	 */
	setLogCapture?(capture: JobLogCapture): void;

	/**
	 * Execute the job.
	 * @returns Promise that resolves when job completes
	 * @returns JobExecutionResult with optional execution details/logs
	 */
	run(): Promise<void | JobExecutionResult>;
}

