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
	UseGuards,
	UseInterceptors,
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
	AgentTaxParamsSchema,
	CreateAgentTaxInputSchema,
	UpdateAgentTaxInputSchema,
	type CreateAgentTaxInput,
	type UpdateAgentTaxInput,
	type Agent as AgentType,
} from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AgentTaxService } from './agent-tax.service.js';
import {
	CreateAgentTaxDto,
	UpdateAgentTaxDto,
	AgentTaxResponseDto,
} from './dto/index.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';
import { LoggerService } from '../../core/logger.service.js';
import { AgentExistsGuard } from '../../common/guards/agent-exists.guard.js';
import { Agent } from '../../common/decorators/agent.decorator.js';

/**
 * Controller for Agent Tax nested endpoints under Agent.
 * Routes: GET/POST/PUT /v1/agents/:id/taxes
 * 
 * Uses AgentExistsGuard to validate agent exists before processing.
 * The validated agent is available via @Agent() decorator.
 */
@ApiTags('agents')
@Controller('v1/agents/:id/taxes')
@UseGuards(AgentExistsGuard)
export class AgentTaxController {
	constructor(
		private readonly service: AgentTaxService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('AgentTaxController');
	}

	/**
	 * Lists taxes for an agent with pagination.
	 * GET /v1/agents/:id/taxes
	 */
	@Get()
	@UseInterceptors(PaginationInterceptor)
	@ApiOperation({
		summary: 'List taxes for an agent',
		description: 'Returns a paginated list of tax records associated with an agent.',
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
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Pagination limit (max: 50, default: 25)',
	})
	@ApiResponse({
		status: 200,
		description: 'List of agent taxes with pagination',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async findAll(
		@Agent() agent: AgentType,
		@Query() query: { offset?: number; limit?: number },
	): Promise<{ items: AgentTaxResponseDto[]; total: number }> {
		const result = await this.service.findByAgentId(agent.id, {
			offset: query.offset ?? 0,
			limit: query.limit ?? 25,
		});

		return {
			items: result.items as unknown as AgentTaxResponseDto[],
			total: result.total,
		};
	}

	/**
	 * Gets a specific tax for an agent.
	 * GET /v1/agents/:id/taxes/:taxId
	 */
	@Get(':taxId')
	@ApiOperation({
		summary: 'Get a specific tax for an agent',
		description: 'Returns a specific tax record associated with an agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
	})
	@ApiParam({
		name: 'taxId',
		type: 'string',
		description: 'AgentTax UUID',
	})
	@ApiResponse({
		status: 200,
		description: 'The agent tax',
		type: AgentTaxResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or tax not found',
	})
	async findById(
		@Agent() agent: AgentType,
		@Param(
			'taxId',
			new ZodValidationPipe(
				AgentTaxParamsSchema.shape.taxId,
				'agent.tax.validation',
			),
		)
		taxId: string,
	): Promise<AgentTaxResponseDto> {
		return this.service.findById(agent.id, taxId) as unknown as Promise<AgentTaxResponseDto>;
	}

	/**
	 * Creates a new tax for an agent.
	 * POST /v1/agents/:id/taxes
	 *
	 * @param agent - Validated agent from guard
	 * @param body - Tax data
	 * @param res - Express response for Location header
	 * @returns The created tax
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a tax for an agent',
		description: 'Creates a new tax record and associates it with the agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
	})
	@ApiBody({
		type: CreateAgentTaxDto,
		description: 'Tax data',
	})
	@ApiResponse({
		status: 201,
		description: 'Tax created successfully',
		type: AgentTaxResponseDto,
		headers: {
			Location: {
				description: 'URL of the created tax',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - agent already has this tax type',
	})
	async create(
		@Agent() agent: AgentType,
		@Body(
			new ZodValidationPipe(
				CreateAgentTaxInputSchema,
				'agent.tax.validation',
			),
		)
		body: CreateAgentTaxInput,
		@Res({ passthrough: true }) res: Response,
	): Promise<AgentTaxResponseDto> {
		const agentTax = await this.service.create(agent.id, body);
		res.setHeader('Location', `/v1/agents/${agent.id}/taxes/${agentTax.id}`);
		return agentTax as unknown as AgentTaxResponseDto;
	}

	/**
	 * Updates a tax for an agent.
	 * PUT /v1/agents/:id/taxes/:taxId
	 */
	@Put(':taxId')
	@ApiOperation({
		summary: 'Update a tax for an agent',
		description: 'Updates the tax value or isPrimary status.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
	})
	@ApiParam({
		name: 'taxId',
		type: 'string',
		description: 'AgentTax UUID',
	})
	@ApiBody({
		type: UpdateAgentTaxDto,
		description: 'Update data',
	})
	@ApiResponse({
		status: 200,
		description: 'Tax updated successfully',
		type: AgentTaxResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or tax not found',
	})
	async update(
		@Agent() agent: AgentType,
		@Param(
			'taxId',
			new ZodValidationPipe(
				AgentTaxParamsSchema.shape.taxId,
				'agent.tax.validation',
			),
		)
		taxId: string,
		@Body(
			new ZodValidationPipe(
				UpdateAgentTaxInputSchema,
				'agent.tax.validation',
			),
		)
		body: UpdateAgentTaxInput,
	): Promise<AgentTaxResponseDto> {
		return this.service.update(agent.id, taxId, body) as unknown as Promise<AgentTaxResponseDto>;
	}
}
