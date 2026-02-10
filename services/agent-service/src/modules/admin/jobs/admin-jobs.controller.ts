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
 * Truncate JSON object intelligently to fit within size limit.
 * Removes or truncates nested fields while preserving structure.
 */
function truncateJsonObject(obj: any, maxSize: number): any {
	const jsonStr = JSON.stringify(obj, null, 2);
	if (jsonStr.length <= maxSize) {
		return obj;
	}

	// If it's an object, try truncating string values or removing fields
	if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
		const truncated: Record<string, any> = {};
		let currentSize = 2; // Account for {}
		
		for (const [key, value] of Object.entries(obj)) {
			const keySize = JSON.stringify(key).length + 4; // "key": 
			let valueStr = JSON.stringify(value, null, 2);
			
			if (currentSize + keySize + valueStr.length > maxSize * 0.9) {
				// Truncate this value or skip it
				const remaining = maxSize - currentSize - keySize - 30; // 30 for "... [truncated]" and formatting
				if (remaining > 50) { // Only add if we have meaningful space
					if (typeof value === 'string' && value.length > remaining) {
						truncated[key] = value.substring(0, remaining) + '... [truncated]';
					} else if (typeof value === 'object') {
						truncated[key] = truncateJsonObject(value, remaining);
					} else {
						truncated[key] = value;
					}
				}
				break; // Stop adding more fields
			} else {
				truncated[key] = value;
				currentSize += keySize + valueStr.length + 2; // Account for comma and newline
			}
		}
		return truncated;
	}

	// For arrays, truncate by removing items
	if (Array.isArray(obj)) {
		const truncated: any[] = [];
		let currentSize = 2; // Account for []
		for (const item of obj) {
			const itemStr = JSON.stringify(item, null, 2);
			if (currentSize + itemStr.length > maxSize * 0.9) {
				break;
			}
			truncated.push(item);
			currentSize += itemStr.length + 4; // Account for comma, newline, and spacing
		}
		return truncated;
	}

	return obj;
}

/**
 * Truncate string at the last complete JSON structure (matching braces/brackets).
 * Ensures the result is valid JSON by finding where the last complete object/array ends.
 * Only truncates after a complete structure - never in the middle of JSON.
 */
function truncateAtLastCompleteStructure(log: string, maxLength: number): string {
	if (log.length <= maxLength) {
		return log;
	}

	// Find the last complete JSON structure by matching braces/brackets
	// We need to find where depth returns to 0 (complete root structure)
	const truncated = log.substring(0, maxLength);
	let depth = 0;
	let lastCompleteIndex = -1;
	let inString = false;
	let escapeNext = false;

	// Track the last position where depth was 0 (complete structure)
	for (let i = 0; i < truncated.length; i++) {
		const char = truncated[i];

		if (escapeNext) {
			escapeNext = false;
			continue;
		}

		if (char === '\\') {
			escapeNext = true;
			continue;
		}

		if (char === '"' && !escapeNext) {
			inString = !inString;
			continue;
		}

		if (inString) {
			continue;
		}

		if (char === '{' || char === '[') {
			depth++;
		} else if (char === '}' || char === ']') {
			depth--;
			// When depth returns to 0, we have a complete root-level structure
			if (depth === 0) {
				lastCompleteIndex = i;
			}
		}
	}

	// If we found a complete structure within reasonable range, truncate there
	// Require it to be at least 80% of maxLength to avoid truncating too early
	if (lastCompleteIndex > maxLength * 0.8 && lastCompleteIndex >= 0) {
		// Verify the truncated JSON is valid by trying to parse it
		const candidate = log.substring(0, lastCompleteIndex + 1);
		try {
			JSON.parse(candidate);
			return candidate + `\n... [truncated ${log.length - lastCompleteIndex - 1} characters]`;
		} catch {
			// Not valid JSON, continue to fallback
		}
	}

	// Fallback: try to find last newline (for pretty-printed JSON)
	const lastNewline = truncated.lastIndexOf('\n');
	if (lastNewline > maxLength * 0.9) {
		// Try to parse up to the newline to ensure it's valid
		const candidate = log.substring(0, lastNewline);
		try {
			JSON.parse(candidate);
			return candidate + `\n... [truncated ${log.length - lastNewline} characters]`;
		} catch {
			// Not valid, continue
		}
	}

	// Last resort: find any closing brace/bracket and verify it creates valid JSON
	const lastBrace = Math.max(
		truncated.lastIndexOf('}'),
		truncated.lastIndexOf(']')
	);

	if (lastBrace > maxLength * 0.9) {
		const candidate = log.substring(0, lastBrace + 1);
		try {
			JSON.parse(candidate);
			return candidate + `\n... [truncated ${log.length - lastBrace - 1} characters]`;
		} catch {
			// Not valid, continue
		}
	}

	// If all else fails, we can't safely truncate without breaking JSON
	// Return the truncated version with a warning
	return truncated + `\n... [truncated ${log.length - maxLength} characters - JSON structure may be incomplete]`;
}

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
			runOnStartup: job.runOnStartup,
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

		// Truncate log if too large (same logic as getJobStatus)
		const MAX_LOG_LENGTH = 100000; // 100KB per log entry
		let log = execution.log;
		if (log && log.length > MAX_LOG_LENGTH) {
			try {
				const parsed = JSON.parse(log);
				const truncated = truncateJsonObject(parsed, MAX_LOG_LENGTH);
				log = JSON.stringify(truncated, null, 2);
				if (log.length > MAX_LOG_LENGTH) {
					log = truncateAtLastCompleteStructure(log, MAX_LOG_LENGTH);
				}
			} catch {
				log = truncateAtLastCompleteStructure(log, MAX_LOG_LENGTH);
			}
		}

		return {
			id: execution.id,
			jobName: execution.jobName,
			status: execution.status,
			startedAt: execution.startedAt,
			finishedAt: execution.finishedAt,
			durationMs: execution.durationMs,
			error: execution.error,
			log: log,
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

		// Truncate large log fields to prevent response size issues
		// Ensures truncation only happens after the last complete JSON structure
		const MAX_LOG_LENGTH = 100000; // 100KB per log entry
		const truncatedExecutions = executions.map((exec) => {
			let log = exec.log;
			if (log && log.length > MAX_LOG_LENGTH) {
				// Try to parse as JSON first - if valid, truncate intelligently
				try {
					const parsed = JSON.parse(log);
					// Truncate the parsed object intelligently
					const truncated = truncateJsonObject(parsed, MAX_LOG_LENGTH);
					log = JSON.stringify(truncated, null, 2);
					
					// If still too large after intelligent truncation, use boundary detection
					if (log.length > MAX_LOG_LENGTH) {
						log = truncateAtLastCompleteStructure(log, MAX_LOG_LENGTH);
					}
				} catch {
					// Not valid JSON - use boundary detection to find last complete structure
					log = truncateAtLastCompleteStructure(log, MAX_LOG_LENGTH);
				}
			}
			return {
				id: exec.id,
				jobName: exec.jobName,
				status: exec.status,
				startedAt: exec.startedAt,
				finishedAt: exec.finishedAt,
				durationMs: exec.durationMs,
				error: exec.error,
				log: log,
				createdAt: exec.createdAt,
			};
		});

		return {
			job: {
				name: job.name,
				description: job.description,
				cronExpression: job.cronExpression,
				enabled: job.enabled,
				runOnStartup: job.runOnStartup,
				lastRunAt: job.lastRunAt,
				nextRunAt: job.nextRunAt,
				runCount: job.runCount,
				failureCount: job.failureCount,
				createdAt: job.createdAt,
				updatedAt: job.updatedAt,
			},
			executions: truncatedExecutions,
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

		try {
			await this.adminJobService.triggerJob(name);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`[${correlationId}] Failed to trigger job`, {
				name,
				error: errorMessage,
			});

			// Convert service errors to appropriate HTTP exceptions
			if (errorMessage.includes('not found') || errorMessage.includes('Job handler not found')) {
				throw new NotFoundException({
					type: 'https://httpstatuses.io/404',
					title: 'Job Not Found',
					status: HttpStatus.NOT_FOUND,
					detail: errorMessage,
					instance: `/v1/admin/jobs/${name}/trigger`,
				});
			}

			// Re-throw other errors (they'll be handled by global exception filter)
			throw error;
		}

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

