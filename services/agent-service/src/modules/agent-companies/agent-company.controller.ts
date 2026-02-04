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
} from '@nestjs/common';
import { Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiParam,
} from '@nestjs/swagger';
import { 
	AgentCompanyIdParamSchema,
	CreateAgentCompanyInput,
	UpdateAgentCompanyInput,
} from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AgentCompanyService } from './agent-company.service.js';
import {
	AgentCompanyResponseDto,
	CreateAgentCompanyDto,
	UpdateAgentCompanyDto,
	AgentCompanyIdParamDto,
} from './dto/index.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';

/**
 * Controller for AgentCompany entity endpoints.
 * Handles HTTP requests related to agent company CRUD operations.
 * 
 * Root routes at /v1/agent-companies for company entity management.
 * Association routes are handled by AgentCompanyAssociationNestedController.
 */
@ApiTags('agent-companies')
@Controller('v1/agent-companies')
export class AgentCompanyController {
	constructor(private readonly service: AgentCompanyService) {}

	/**
	 * Retrieves all agent companies (paginated).
	 * GET /v1/agent-companies
	 *
	 * @param query - Query parameters (pagination, filters, etc.)
	 * @returns Paginated list of companies
	 */
	@Get()
	@UseInterceptors(PaginationInterceptor)
	@ApiOperation({
		summary: 'List all agent companies',
		description: 'Returns a paginated list of all agent companies (brokerages).',
	})
	@ApiResponse({
		status: 200,
		description: 'List of companies',
		type: [AgentCompanyResponseDto],
	})
	async findAll(
		@Query() query: any,
	): Promise<{ items: AgentCompanyResponseDto[]; total: number }> {
		const result = await this.service.findPage(query);
		return { items: result.items as unknown as AgentCompanyResponseDto[], total: result.total };
	}

	/**
	 * Retrieves a single company by ID.
	 * GET /v1/agent-companies/:id
	 *
	 * @param params - Company ID parameter
	 * @returns The company
	 */
	@Get(':id')
	@ApiOperation({
		summary: 'Get an agent company by ID',
		description: 'Returns a single agent company.',
	})
	@ApiParam({
		name: 'id',
		description: 'Company UUID',
		type: 'string',
	})
	@ApiResponse({
		status: 200,
		description: 'The company',
		type: AgentCompanyResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Company not found',
	})
	async findById(
		@Param(
			new ZodValidationPipe(
				AgentCompanyIdParamSchema,
				'agent.company.validation',
			),
		)
		params: AgentCompanyIdParamDto,
	): Promise<AgentCompanyResponseDto> {
		return this.service.findById(params.id) as Promise<AgentCompanyResponseDto>;
	}

	/**
	 * Creates a new company.
	 * POST /v1/agent-companies
	 *
	 * @param body - Company data
	 * @param res - Express response for Location header
	 * @returns The created company
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new agent company',
		description: 'Creates a new agent company (brokerage).',
	})
	@ApiBody({
		type: CreateAgentCompanyDto,
		description: 'Company data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Company created successfully',
		type: AgentCompanyResponseDto,
		headers: {
			Location: {
				description: 'URL of the created company',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name',
	})
	async create(
		@Body(
			new ZodValidationPipe(
				CreateAgentCompanyInput,
				'agent.company.validation',
			),
		)
		body: CreateAgentCompanyDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<AgentCompanyResponseDto> {
		const company = await this.service.create(body as unknown as any);
		res.setHeader('Location', `/v1/agent-companies/${company.id}`);
		return company as unknown as AgentCompanyResponseDto;
	}

	/**
	 * Updates a company.
	 * PUT /v1/agent-companies/:id
	 *
	 * @param params - Company ID parameter
	 * @param body - Update data
	 * @returns The updated company
	 */
	@Put(':id')
	@ApiOperation({
		summary: 'Update an agent company',
		description: 'Updates an existing agent company.',
	})
	@ApiParam({
		name: 'id',
		description: 'Company UUID',
		type: 'string',
	})
	@ApiBody({
		type: UpdateAgentCompanyDto,
		description: 'Company update data',
	})
	@ApiResponse({
		status: 200,
		description: 'Company updated successfully',
		type: AgentCompanyResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Company not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name',
	})
	async update(
		@Param(
			new ZodValidationPipe(
				AgentCompanyIdParamSchema,
				'agent.company.validation',
			),
		)
		params: AgentCompanyIdParamDto,
		@Body(
			new ZodValidationPipe(
				UpdateAgentCompanyInput,
				'agent.company.validation',
			),
		)
		body: UpdateAgentCompanyDto,
	): Promise<AgentCompanyResponseDto> {
		return this.service.update(params.id, body as unknown as any) as Promise<AgentCompanyResponseDto>;
	}
}
