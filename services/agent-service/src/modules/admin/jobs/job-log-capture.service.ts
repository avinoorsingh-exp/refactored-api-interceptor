import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Log entry types captured during job execution.
 */
export interface JobLogEntry {
	timestamp: string;
	type: 'log' | 'query' | 'result';
	level?: 'info' | 'warn' | 'error' | 'debug';
	message?: string;
	data?: Record<string, unknown>;
	sql?: string;
	parameters?: unknown[];
	duration?: string;
}

/**
 * Service for capturing execution logs during job runs.
 * Captures database queries and log messages for storage in execution records.
 */
@Injectable()
export class JobLogCaptureService {
	private logs: JobLogEntry[] = [];
	private originalQueryLogger?: (query: string, parameters?: unknown[]) => void;
	private queryRunner?: QueryRunner;
	private activityCallback?: () => void | Promise<void>;

	/**
	 * Start capturing logs for a job execution.
	 * Sets up query logging interception and initializes log buffer.
	 * @param dataSource - TypeORM DataSource for query interception
	 * @param activityCallback - Optional callback invoked when execution activity occurs (for lastActivityAt tracking)
	 *                          Can be async, but is invoked in fire-and-forget manner (not awaited)
	 */
	startCapture(dataSource: DataSource, activityCallback?: () => void | Promise<void>): void {
		this.logs = [];
		this.activityCallback = activityCallback;
		this.log('info', 'Job execution started', {});

		// Create a query runner to intercept queries
		this.queryRunner = dataSource.createQueryRunner();
		
		// Note: TypeORM doesn't provide a direct way to intercept all queries
		// We'll capture queries through the queryRunner's logging if enabled
		// For now, we'll rely on jobs to explicitly log their queries
	}

	/**
	 * Log a message entry.
	 */
	log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: Record<string, unknown>): void {
		this.logs.push({
			timestamp: new Date().toISOString(),
			type: 'log',
			level,
			message,
			data: data || {},
		});
		// Signal execution activity (fire-and-forget, don't await to avoid blocking)
		if (this.activityCallback) {
			const result = this.activityCallback();
			// If callback returns a promise, catch any errors but don't await
			if (result instanceof Promise) {
				result.catch((err) => {
					// Silently ignore errors in activity callback to prevent blocking execution
					// Errors are logged by the callback implementation itself
				});
			}
		}
	}

	/**
	 * Log a database query.
	 */
	logQuery(sql: string, parameters?: unknown[], duration?: number): void {
		this.logs.push({
			timestamp: new Date().toISOString(),
			type: 'query',
			sql,
			parameters,
			duration: duration !== undefined ? `${duration}ms` : undefined,
		});
		// Signal execution activity (fire-and-forget, don't await to avoid blocking)
		if (this.activityCallback) {
			const result = this.activityCallback();
			// If callback returns a promise, catch any errors but don't await
			if (result instanceof Promise) {
				result.catch((err) => {
					// Silently ignore errors in activity callback to prevent blocking execution
					// Errors are logged by the callback implementation itself
				});
			}
		}
	}

	/**
	 * Log execution result/summary.
	 */
	logResult(data: Record<string, unknown>): void {
		this.logs.push({
			timestamp: new Date().toISOString(),
			type: 'result',
			data,
		});
		// Signal execution activity (fire-and-forget, don't await to avoid blocking)
		if (this.activityCallback) {
			const result = this.activityCallback();
			// If callback returns a promise, catch any errors but don't await
			if (result instanceof Promise) {
				result.catch((err) => {
					// Silently ignore errors in activity callback to prevent blocking execution
					// Errors are logged by the callback implementation itself
				});
			}
		}
	}

	/**
	 * Stop capturing and get all logs as JSON string.
	 */
	stopCapture(): string {
		this.log('info', 'Job execution completed', {});
		
		if (this.queryRunner) {
			this.queryRunner.release();
			this.queryRunner = undefined;
		}

		// Clear activity callback
		this.activityCallback = undefined;

		return JSON.stringify(this.logs, null, 2);
	}

	/**
	 * Get current logs without stopping capture.
	 */
	getLogs(): JobLogEntry[] {
		return [...this.logs];
	}

	/**
	 * Clear all captured logs.
	 */
	clear(): void {
		this.logs = [];
	}
}

