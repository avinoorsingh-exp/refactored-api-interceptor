import {
	Controller,
	Get,
	Post,
	Put,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	Res,
	UseInterceptors,
	UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';
import {
	CreateLicenseInputSchema,
	UpdateLicenseInputSchema,
	LicenseIdParamSchema,
} from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js';
import { LicenseService } from './license.service.js';
import {
	LicenseResponseDto,
	CreateLicenseDto,
	UpdateLicenseDto,
} from './dto/index.js';
import { PaginationInterceptor } from '../../../common/pagination/pagination.interceptor.js';
import { LoggerService } from '../../../core/logger.service.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import { Agent } from '../../../common/decorators/agent.decorator.js';
import type { Agent as AgentType } from '@exprealty/shared-domain';

/**
 * Controller for License nested endpoints under Agent.
 * Routes: GET/POST/PUT /v1/agents/:id/licenses
 *
 * Uses AgentExistsGuard to validate agent exists before processing.
 * The validated agent is available via @Agent() decorator.
 */
@ApiTags('licenses')
@Controller('v1/agents/:id/licenses')
@UseGuards(AgentExistsGuard)
export class LicenseController {
	constructor(
		private readonly licenseService: LicenseService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('LicenseController');
	}

	/**
	 * Lists licenses for an agent with pagination.
	 * GET /v1/agents/:id/licenses
	 */
	@Get()
	@UseInterceptors(PaginationInterceptor)
	@ApiOperation({
		summary: 'List licenses for an agent',
		description: 'Returns a paginated list of licenses for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiQuery({
		name: 'offset',
		required: false,
		type: Number,
		description: 'Pagination offset (default: 0)',
		example: 0,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Pagination limit (max: 50, default: 25)',
		example: 25,
	})
	@ApiResponse({
		status: 200,
		description: 'List of licenses with pagination',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async findAll(
		@Agent() agent: AgentType,
		@Query() query: { offset?: number; limit?: number },
	): Promise<{ items: LicenseResponseDto[]; total: number }> {
		const result = await this.licenseService.findByAgentId(agent.id, {
			offset: query.offset ?? 0,
			limit: query.limit ?? 25,
		});

		return {
			items: result.items as unknown as LicenseResponseDto[],
			total: result.total,
		};
	}

	/**
	 * Gets a specific license by ID.
	 * GET /v1/agents/:id/licenses/:licenseId
	 */
	@Get(':licenseId')
	@ApiOperation({
		summary: 'Get a license by ID',
		description: 'Returns a single license for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'licenseId',
		type: 'string',
		description: 'License UUID',
		example: '123e4567-e89b-12d3-a456-426614174001',
	})
	@ApiResponse({
		status: 200,
		description: 'License found',
		type: LicenseResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or license not found',
	})
	async findById(
		@Agent() agent: AgentType,
		@Param('licenseId', new ZodValidationPipe(LicenseIdParamSchema.shape.licenseId, 'license.validation'))
		licenseId: string,
	): Promise<LicenseResponseDto> {
		return this.licenseService.findById(agent.id, licenseId) as unknown as Promise<LicenseResponseDto>;
	}

	/**
	 * Creates a new license for an agent.
	 * POST /v1/agents/:id/licenses
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a license',
		description: 'Creates a new license for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiBody({
		type: CreateLicenseDto,
		description: 'License data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'License created successfully',
		type: LicenseResponseDto,
		headers: {
			Location: {
				description: 'URL of the created license',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate license number',
	})
	async create(
		@Agent() agent: AgentType,
		@Body(new ZodValidationPipe(CreateLicenseInputSchema, 'license.validation'))
		body: CreateLicenseDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<LicenseResponseDto> {
		this.logger.info(`Creating license for agent ${agent.id}`);

		const license = await this.licenseService.create(agent.id, body);

		res.setHeader('Location', `/v1/agents/${agent.id}/licenses/${license.id}`);

		return license as unknown as LicenseResponseDto;
	}

	/**
	 * Updates a license for an agent.
	 * PUT /v1/agents/:id/licenses/:licenseId
	 */
	@Put(':licenseId')
	@ApiOperation({
		summary: 'Update a license',
		description: 'Updates an existing license for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'licenseId',
		type: 'string',
		description: 'License UUID',
		example: '123e4567-e89b-12d3-a456-426614174001',
	})
	@ApiBody({
		type: UpdateLicenseDto,
		description: 'License data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'License updated successfully',
		type: LicenseResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or license not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate license number',
	})
	async update(
		@Agent() agent: AgentType,
		@Param('licenseId', new ZodValidationPipe(LicenseIdParamSchema.shape.licenseId, 'license.validation'))
		licenseId: string,
		@Body(new ZodValidationPipe(UpdateLicenseInputSchema, 'license.validation'))
		body: UpdateLicenseDto,
	): Promise<LicenseResponseDto> {
		this.logger.info(`Updating license ${licenseId} for agent ${agent.id}`);

		return this.licenseService.update(agent.id, licenseId, body) as unknown as Promise<LicenseResponseDto>;
	}
}
