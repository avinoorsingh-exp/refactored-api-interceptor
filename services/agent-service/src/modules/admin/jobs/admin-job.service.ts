import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { LoggerService } from '../../../core/logger.service.js';
import { AdminJobHandler, JobExecutionResult } from './admin-job-handler.interface.js';
import { AdminJobEntity, AdminJobExecutionEntity, AdminJobExecutionStatus } from '@exprealty/database';
import { JobLogCaptureService } from './job-log-capture.service.js';

/**
 * Service for managing scheduled jobs.
 * Registers jobs, tracks execution, and provides admin controls.
 */
@Injectable()
export class AdminJobService implements OnApplicationBootstrap {
	private readonly logger: LoggerService;
	private readonly handlers = new Map<string, AdminJobHandler>();

	constructor(
		@InjectRepository(AdminJobEntity)
		private readonly jobRepo: Repository<AdminJobEntity>,
		@InjectRepository(AdminJobExecutionEntity)
		private readonly executionRepo: Repository<AdminJobExecutionEntity>,
		private readonly dataSource: DataSource,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly logCaptureService: JobLogCaptureService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('AdminJobService');
	}

	/**
	 * Register a job handler.
	 * Called by job implementations during module initialization.
	 */
	register(handler: AdminJobHandler): void {
		this.handlers.set(handler.name, handler);
		this.logger.info('Job handler registered', {
			name: handler.name,
			cron: handler.cron,
		});
	}

	/**
	 * Initialize jobs from database on application bootstrap.
	 */
	async onApplicationBootstrap(): Promise<void> {
		this.logger.info('AdminJobService onApplicationBootstrap called', {
			handlerCount: this.handlers.size,
			handlerNames: Array.from(this.handlers.keys()),
		});

		// STEP 1: Reconcile orphaned RUNNING executions from previous server instance
		// This must run BEFORE jobs are scheduled to prevent new executions from starting
		// while orphaned executions are being cleaned up
		await this.reconcileOrphanedExecutions();

		if (this.handlers.size === 0) {
			this.logger.warn('No job handlers registered - jobs will not be initialized automatically');
			return;
		}

		for (const [name, handler] of this.handlers.entries()) {
			this.logger.info('Initializing job', { name, hasCron: !!handler.cron });
			await this.initializeJob(name, handler);
			
			// Only schedule jobs that have a cron expression and are enabled
			const job = await this.jobRepo.findOne({ where: { name } });
			if (job?.enabled && job.cronExpression) {
				this.addCronJob(job.name, job.cronExpression, async () => {
					await this.executeJob(job.name);
				});
				this.logger.info('Scheduled job with cron', { name, cron: job.cronExpression });
			} else if (!job?.cronExpression) {
				this.logger.info('Job is manual-only (no cron schedule)', { name });
			}
		}

		this.logger.info('Admin jobs initialization completed', {
			initializedCount: this.handlers.size,
		});
	}

	/**
	 * Initialize a single job from database or create default entry.
	 */
	private async initializeJob(name: string, handler: AdminJobHandler): Promise<void> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			let job = await queryRunner.manager.findOne(AdminJobEntity, {
				where: { name },
			});

			if (!job) {
				job = queryRunner.manager.create(AdminJobEntity, {
					name,
					description: handler.description,
					cronExpression: handler.cron || null, // Allow null for manual jobs
					enabled: true,
					runCount: 0,
					failureCount: 0,
				});
				await queryRunner.manager.save(job);
				this.logger.info('Created job record in database', { 
					name, 
					isManual: !handler.cron 
				});
			} else {
				const updatedJob = queryRunner.manager.merge(AdminJobEntity, job, {
					description: handler.description,
					cronExpression: handler.cron || null, // Allow null for manual jobs
				});
				await queryRunner.manager.save(updatedJob);
			}

			await queryRunner.commitTransaction();
		} catch (error) {
			await queryRunner.rollbackTransaction();
			this.logger.error('Failed to initialize job', {
				name,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Add a cron job to the scheduler registry.
	 * Checks if a cron job with the same name already exists to avoid duplicate registration errors.
	 * @private
	 */
	private addCronJob(name: string, cronExpression: string, callback: () => Promise<void>): void {
		try {
			// Check if cron job already exists
			const existingJob = this.schedulerRegistry.getCronJob(name);
			if (existingJob) {
				this.logger.warn(`Cron job '${name}' already exists, skipping registration`, { cronExpression });
				return;
			}
		} catch (error) {
			// Job doesn't exist, which is fine - we'll create it
		}

		const job = new CronJob(cronExpression, async () => {
			this.logger.debug(`Scheduled job '${name}' triggered`);
			await callback();
		});
		
		try {
			this.schedulerRegistry.addCronJob(name, job);
			job.start();
			this.logger.info(`Cron job '${name}' scheduled`, { cronExpression });
		} catch (error) {
			// Handle case where cron job already exists (e.g., from previous deployment or hot reload)
			if (error instanceof Error && error.message.includes('already exists')) {
				this.logger.warn(`Cron job '${name}' already exists in registry, skipping registration`, { cronExpression });
			} else {
				throw error; // Re-throw unexpected errors
			}
		}
	}

	/**
	 * Execute a job safely with error handling and execution tracking.
	 * This method is called by job handlers when they run.
	 */
	async executeJob(name: string): Promise<void> {
		const handler = this.handlers.get(name);
		if (!handler) {
			this.logger.warn('Job handler not found', { name });
			return;
		}

		const job = await this.jobRepo.findOne({ where: { name } });
		if (!job || !job.enabled) {
			return;
		}

		const execution = this.executionRepo.create({
			jobName: name,
			status: AdminJobExecutionStatus.RUNNING,
			startedAt: new Date(),
			lastActivityAt: new Date(), // Initialize activity timestamp
		});
		await this.executionRepo.save(execution);

		const startTime = Date.now();
		
		// Start capturing logs for this execution with activity callback
		// The callback updates lastActivityAt whenever execution activity occurs
		this.logCaptureService.startCapture(this.dataSource, async () => {
			// Update lastActivityAt whenever activity occurs (log, query, result)
			execution.lastActivityAt = new Date();
			await this.executionRepo.save(execution);
		});

		try {
			let executionResult: JobExecutionResult | void;
			if ('execute' in handler && typeof handler.execute === 'function') {
				// Pass log capture service to handler if it accepts it
				const handlerWithLogs = handler as any;
				if (handlerWithLogs.setLogCapture) {
					handlerWithLogs.setLogCapture(this.logCaptureService);
				}
				executionResult = await handlerWithLogs.execute();
			} else {
				const handlerWithLogs = handler as any;
				if (handlerWithLogs.setLogCapture) {
					handlerWithLogs.setLogCapture(this.logCaptureService);
				}
				executionResult = await handler.run();
			}

			const durationMs = Date.now() - startTime;
			execution.status = AdminJobExecutionStatus.SUCCESS;
			execution.finishedAt = new Date();
			execution.durationMs = durationMs;
			
			// Combine captured logs with execution result
			const capturedLogs = this.logCaptureService.stopCapture();
			let finalLog = capturedLogs;
			
			if (executionResult && executionResult.log) {
				// Merge execution result into logs
				try {
					const logsArray = JSON.parse(capturedLogs);
					logsArray.push({
						timestamp: new Date().toISOString(),
						type: 'result',
						data: JSON.parse(executionResult.log),
					});
					finalLog = JSON.stringify(logsArray, null, 2);
				} catch {
					// If parsing fails, append as text
					finalLog = `${capturedLogs}\n\n--- Execution Result ---\n${executionResult.log}`;
				}
			}
			
			execution.log = finalLog;
			await this.executionRepo.save(execution);

			job.runCount += 1;
			job.lastRunAt = new Date();
			await this.jobRepo.save(job);

			this.logger.info('Job executed successfully', {
				name,
				durationMs,
			});
		} catch (error) {
			const durationMs = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;

			// Capture error in logs
			this.logCaptureService.log('error', 'Job execution failed', {
				error: errorMessage,
				stack: errorStack,
			});

			// Stop capture and store logs
			const capturedLogs = this.logCaptureService.stopCapture();

			execution.status = AdminJobExecutionStatus.FAILED;
			execution.finishedAt = new Date();
			execution.durationMs = durationMs;
			execution.error = errorMessage;
			execution.log = capturedLogs;
			await this.executionRepo.save(execution);

			job.runCount += 1;
			job.failureCount += 1;
			job.lastRunAt = new Date();
			await this.jobRepo.save(job);

			this.logger.error('Job execution failed', {
				name,
				durationMs,
				error: errorMessage,
				stack: errorStack,
			});
		}
	}

	/**
	 * Manually trigger a job execution.
	 */
	async triggerJob(name: string): Promise<void> {
		const handler = this.handlers.get(name);
		if (!handler) {
			throw new Error(`Job handler not found: ${name}`);
		}

		const job = await this.jobRepo.findOne({ where: { name } });
		if (!job) {
			throw new Error(`Job not found: ${name}`);
		}

		this.logger.info('Manually triggering job', { name });
		await this.executeJob(name);
	}

	/**
	 * Pause a job (disable scheduling).
	 * For manual jobs (no cron), this just disables the job.
	 */
	async pauseJob(name: string): Promise<void> {
		const job = await this.jobRepo.findOne({ where: { name } });
		if (!job) {
			throw new Error(`Job not found: ${name}`);
		}

		if (!job.enabled) {
			return;
		}

		job.enabled = false;
		await this.jobRepo.save(job);

		// Only stop cron job if it has a schedule
		if (job.cronExpression) {
			try {
				const cronJob = this.schedulerRegistry.getCronJob(name);
				cronJob.stop();
				this.logger.info('Scheduled job paused', { name });
			} catch (error) {
				this.logger.warn('Could not stop cron job (may not be scheduled)', {
					name,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		} else {
			this.logger.info('Manual job disabled', { name });
		}
	}

	/**
	 * Resume a job (enable scheduling).
	 * For manual jobs (no cron), this just enables the job.
	 */
	async resumeJob(name: string): Promise<void> {
		const job = await this.jobRepo.findOne({ where: { name } });
		if (!job) {
			throw new Error(`Job not found: ${name}`);
		}

		if (job.enabled) {
			return;
		}

		job.enabled = true;
		await this.jobRepo.save(job);

		// Only start cron job if it has a schedule
		if (job.cronExpression) {
			try {
				const cronJob = this.schedulerRegistry.getCronJob(name);
				cronJob.start();
				this.logger.info('Scheduled job resumed', { name });
			} catch (error) {
				this.logger.warn('Could not start cron job (may not be scheduled)', {
					name,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		} else {
			this.logger.info('Manual job enabled', { name });
		}
	}

	/**
	 * Get all jobs with metadata.
	 */
	async getAllJobs(): Promise<AdminJobEntity[]> {
		return this.jobRepo.find({
			order: { name: 'ASC' },
		});
	}

	/**
	 * Get a single job by name.
	 */
	async getJob(name: string): Promise<AdminJobEntity | null> {
		return this.jobRepo.findOne({ where: { name } });
	}

	/**
	 * Get execution history for a job.
	 */
	async getJobExecutions(
		name: string,
		limit: number = 50,
	): Promise<AdminJobExecutionEntity[]> {
		return this.executionRepo.find({
			where: { jobName: name },
			order: { startedAt: 'DESC' },
			take: limit,
		});
	}

	/**
	 * Get a single execution by ID.
	 */
	async getExecution(id: string): Promise<AdminJobExecutionEntity | null> {
		return this.executionRepo.findOne({ where: { id } });
	}

	/**
	 * Reconcile orphaned RUNNING executions from previous server instance.
	 * 
	 * On server restart, any RUNNING executions are orphaned because:
	 * - In-memory execution processes are terminated
	 * - No further logs will be produced
	 * - Frontend continues polling indefinitely
	 * 
	 * This method:
	 * - Finds all RUNNING executions (orphaned due to restart)
	 * - Fails them using the existing system-managed failure mechanism
	 * - Sets error message to "System Restart"
	 * - Ensures frontend polling resolves naturally
	 * 
	 * Must be called during application bootstrap BEFORE jobs are scheduled.
	 */
	private async reconcileOrphanedExecutions(): Promise<void> {
		this.logger.info('Starting reconciliation of orphaned executions');

		try {
			// Find all RUNNING executions (all are orphaned after restart)
			const orphanedExecutions = await this.executionRepo.find({
				where: { status: AdminJobExecutionStatus.RUNNING },
			});

			if (orphanedExecutions.length === 0) {
				this.logger.info('No orphaned executions found');
				return;
			}

			this.logger.info('Found orphaned executions', {
				count: orphanedExecutions.length,
				executionIds: orphanedExecutions.map(e => e.id),
			});

			// Process each orphaned execution individually
			// Errors in one execution must not block others
			for (const execution of orphanedExecutions) {
				try {
					await this.failOrphanedExecution(execution);
				} catch (error) {
					// Log error but continue processing other executions
					this.logger.error('Failed to reconcile orphaned execution', {
						executionId: execution.id,
						jobName: execution.jobName,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			this.logger.info('Orphaned execution reconciliation completed', {
				processedCount: orphanedExecutions.length,
			});
		} catch (error) {
			// Log error but do not block application startup
			this.logger.error('Error during orphaned execution reconciliation', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Fail an orphaned execution using the existing system-managed failure mechanism.
	 * 
	 * This method mimics the failure handling in executeJob's catch block to ensure
	 * consistent behavior and use the same system-controlled status transition.
	 * 
	 * @param execution - The orphaned execution to fail
	 */
	private async failOrphanedExecution(execution: AdminJobExecutionEntity): Promise<void> {
		const now = new Date();
		// Calculate duration from start to reconciliation time
		const durationMs = now.getTime() - execution.startedAt.getTime();

		// Use the same failure mechanism as executeJob catch block
		// This ensures system-managed status transition (not manual mutation)
		execution.status = AdminJobExecutionStatus.FAILED;
		execution.finishedAt = now;
		execution.durationMs = durationMs;
		execution.error = 'System Restart'; // Exact error message as required

		// Update log to indicate this was failed due to system restart
		const existingLog = execution.log || '[]';
		let logArray: any[] = [];
		try {
			logArray = JSON.parse(existingLog);
		} catch {
			// If log is not JSON, wrap it
			logArray = [{ timestamp: execution.startedAt.toISOString(), type: 'log', message: existingLog }];
		}

		// Add reconciliation log entry
		logArray.push({
			timestamp: now.toISOString(),
			type: 'log',
			level: 'error',
			message: 'Execution failed due to system restart',
			data: {
				reason: 'System Restart',
				reconciledAt: now.toISOString(),
				originalStartedAt: execution.startedAt.toISOString(),
			},
		});

		execution.log = JSON.stringify(logArray, null, 2);
		await this.executionRepo.save(execution);

		// Update job metadata (increment failure count)
		const job = await this.jobRepo.findOne({ where: { name: execution.jobName } });
		if (job) {
			job.failureCount += 1;
			job.runCount += 1; // Count as a run attempt
			job.lastRunAt = execution.startedAt; // Keep original start time
			await this.jobRepo.save(job);
		}

		this.logger.info('Orphaned execution failed', {
			executionId: execution.id,
			jobName: execution.jobName,
			startedAt: execution.startedAt.toISOString(),
			durationMs,
		});
	}
}

