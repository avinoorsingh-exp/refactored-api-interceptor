import {
	Controller,
	Get,
	Post,
	Param,
	HttpCode,
	HttpStatus,
	Req,
	NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
} from '@nestjs/swagger';
import { AdminJobService } from './admin-job.service.js';
import { AdminJobResponseDto } from './dto/admin-job-response.dto.js';
import { AdminJobExecutionResponseDto } from './dto/admin-job-execution-response.dto.js';
import { AdminJobNameParamDto } from './dto/admin-job-name-param.dto.js';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Controller for admin job management endpoints.
 */
@ApiTags('admin-jobs')
@Controller('v1/admin/jobs')
export class AdminJobsController {
	private readonly logger: LoggerService;

	constructor(
		private readonly adminJobService: AdminJobService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('AdminJobsController');
	}

	/**
	 * Get all scheduled jobs.
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List all scheduled jobs',
		description: 'Returns all registered scheduled jobs with their metadata and execution statistics.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of scheduled jobs',
		type: [AdminJobResponseDto],
	})
	async getJobs(@Req() req: Request): Promise<AdminJobResponseDto[]> {
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] GET /v1/admin/jobs - Listing all jobs`);

		const jobs = await this.adminJobService.getAllJobs();
		return jobs.map((job) => ({
			name: job.name,
			description: job.description,
			cronExpression: job.cronExpression,
			enabled: job.enabled,
			lastRunAt: job.lastRunAt,
			nextRunAt: job.nextRunAt,
			runCount: job.runCount,
			failureCount: job.failureCount,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
		}));
	}

	/**
	 * Get a single execution by ID.
	 * Must come before :name/status to avoid route conflicts.
	 */
	@Get('executions/:id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get execution details by ID',
		description: 'Returns detailed information about a specific job execution, including logs.',
	})
	@ApiParam({
		name: 'id',
		description: 'Execution ID (UUID)',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Execution details',
		type: AdminJobExecutionResponseDto,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Execution not found',
	})
	async getExecution(
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<AdminJobExecutionResponseDto> {
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] GET /v1/admin/jobs/executions/${id}`);

		const execution = await this.adminJobService.getExecution(id);
		if (!execution) {
			throw new NotFoundException({
				message: `Execution not found: ${id}`,
				i18nType: 'admin.job.execution.not_found',
			});
		}

		return {
			id: execution.id,
			jobName: execution.jobName,
			status: execution.status,
			startedAt: execution.startedAt,
			finishedAt: execution.finishedAt,
			durationMs: execution.durationMs,
			error: execution.error,
			log: execution.log,
			createdAt: execution.createdAt,
		};
	}

	/**
	 * Get job status and execution history.
	 */
	@Get(':name/status')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get job status and execution history',
		description: 'Returns job metadata and recent execution history.',
	})
	@ApiParam({
		name: 'name',
		description: 'Job name',
		type: String,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job status and execution history',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Job not found',
	})
	async getJobStatus(
		@Param('name') name: string,
		@Req() req: Request,
	): Promise<{
		job: AdminJobResponseDto;
		executions: AdminJobExecutionResponseDto[];
	}> {
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] GET /v1/admin/jobs/${name}/status`);

		const job = await this.adminJobService.getJob(name);
		if (!job) {
			throw new NotFoundException({
				message: `Job not found: ${name}`,
				i18nType: 'admin.job.not_found',
			});
		}

		const executions = await this.adminJobService.getJobExecutions(name, 50);

		return {
			job: {
				name: job.name,
				description: job.description,
				cronExpression: job.cronExpression,
				enabled: job.enabled,
				lastRunAt: job.lastRunAt,
				nextRunAt: job.nextRunAt,
				runCount: job.runCount,
				failureCount: job.failureCount,
				createdAt: job.createdAt,
				updatedAt: job.updatedAt,
			},
			executions: executions.map((exec) => ({
				id: exec.id,
				jobName: exec.jobName,
				status: exec.status,
				startedAt: exec.startedAt,
				finishedAt: exec.finishedAt,
				durationMs: exec.durationMs,
				error: exec.error,
				log: exec.log,
				createdAt: exec.createdAt,
			})),
		};
	}

	/**
	 * Manually trigger a job execution.
	 */
	@Post(':name/trigger')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Manually trigger a job',
		description: 'Immediately executes a job, regardless of its schedule.',
	})
	@ApiParam({
		name: 'name',
		description: 'Job name',
		type: String,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job triggered successfully',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Job not found',
	})
	async triggerJob(
		@Param('name') name: string,
		@Req() req: Request,
	): Promise<{ message: string }> {
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/admin/jobs/${name}/trigger`);

		await this.adminJobService.triggerJob(name);

		return {
			message: `Job ${name} triggered successfully`,
		};
	}

	/**
	 * Pause a job (disable scheduling).
	 */
	@Post(':name/pause')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Pause a job',
		description: 'Disables scheduling for a job. The job will not run until resumed.',
	})
	@ApiParam({
		name: 'name',
		description: 'Job name',
		type: String,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job paused successfully',
	})
	async pauseJob(
		@Param('name') name: string,
		@Req() req: Request,
	): Promise<{ message: string }> {
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/admin/jobs/${name}/pause`);

		await this.adminJobService.pauseJob(name);

		return {
			message: `Job ${name} paused successfully`,
		};
	}

	/**
	 * Resume a job (enable scheduling).
	 */
	@Post(':name/resume')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Resume a job',
		description: 'Enables scheduling for a paused job.',
	})
	@ApiParam({
		name: 'name',
		description: 'Job name',
		type: String,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job resumed successfully',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Job not found',
	})
	async resumeJob(
		@Param('name') name: string,
		@Req() req: Request,
	): Promise<{ message: string }> {
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/admin/jobs/${name}/resume`);

		await this.adminJobService.resumeJob(name);

		return {
			message: `Job ${name} resumed successfully`,
		};
	}

	/**
	 * Extract correlation ID from request headers.
	 */
	private getCorrelationId(req: Request): string {
		return (req.headers['x-correlation-id'] as string) || 'unknown';
	}
}

