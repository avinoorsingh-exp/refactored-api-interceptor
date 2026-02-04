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
	NotFoundException,
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
	AgentCompanyAssociationIdParamSchema,
	CreateAgentCompanyAssociationSchema,
	UpdateAgentCompanyAssociationSchema,
	CreateAgentCompanyAssociationInput,
	UpdateAgentCompanyAssociationInput,
} from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AgentCompanyAssociationService } from './agent-company-association.service.js';
import {
	CreateAgentCompanyAssociationDto,
	UpdateAgentCompanyAssociationDto,
	AgentCompanyAssociationIdParamDto,
	AgentCompanyAssociationResponseDto,
} from './dto/index.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';
import { LoggerService } from '../../core/logger.service.js';
import { AgentExistsGuard } from '../../common/guards/agent-exists.guard.js';
import { Agent } from '../../common/decorators/agent.decorator.js';
import type { Agent as AgentType } from '@exprealty/shared-domain';

/**
 * Controller for Agent Company Association nested endpoints under Agent.
 * Routes: GET/POST/PUT/DELETE /v1/agents/:id/agent-companies
 * 
 * Uses AgentExistsGuard to validate agent exists before processing.
 * The validated agent is available via @Agent() decorator.
 */
@ApiTags('agents')
@Controller('v1/agents/:id/agent-companies')
@UseGuards(AgentExistsGuard)
export class AgentCompanyAssociationNestedController {
	constructor(
		private readonly service: AgentCompanyAssociationService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('AgentCompanyAssociationNestedController');
	}

	/**
	 * Lists agent company associations for an agent.
	 * GET /v1/agents/:id/agent-companies
	 */
	@Get()
	@ApiOperation({
		summary: 'List agent company associations for an agent',
		description: 'Returns all companies an agent is associated with.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiResponse({
		status: 200,
		description: 'List of agent company associations',
		type: [AgentCompanyAssociationResponseDto],
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async findAll(
		@Agent() agent: AgentType,
	): Promise<AgentCompanyAssociationResponseDto[]> {
		const associations = await this.service.findByAgentId(agent.id);
		return associations as unknown as AgentCompanyAssociationResponseDto[];
	}

	/**
	 * Creates a new agent company association.
	 * POST /v1/agents/:id/agent-companies
	 *
	 * @param agent - Validated agent from guard
	 * @param body - Association data
	 * @param res - Express response for Location header
	 * @returns The created association
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Associate agent with a company',
		description: 'Creates a new association between an agent and a company.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
	})
	@ApiBody({
		type: CreateAgentCompanyAssociationDto,
		description: 'Association data',
	})
	@ApiResponse({
		status: 201,
		description: 'Association created successfully',
		type: AgentCompanyAssociationResponseDto,
		headers: {
			Location: {
				description: 'URL of the created association',
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
		description: 'Conflict - association already exists',
	})
	async create(
		@Agent() agent: AgentType,
		@Body(
			new ZodValidationPipe(
				CreateAgentCompanyAssociationSchema,
				'agent.company_association.validation',
			),
		)
		body: CreateAgentCompanyAssociationInput,
		@Res({ passthrough: true }) res: Response,
	): Promise<AgentCompanyAssociationResponseDto> {
		const association = await this.service.create(agent.id, body);
		res.setHeader('Location', `/v1/agents/${agent.id}/agent-companies/${association.id}`);
		return association as unknown as AgentCompanyAssociationResponseDto;
	}

	/**
	 * Updates an agent company association.
	 * PUT /v1/agents/:id/agent-companies/:associationId
	 */
	@Put(':associationId')
	@ApiOperation({
		summary: 'Update an agent company association',
		description: 'Updates the isPrimary status of an association.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
	})
	@ApiParam({
		name: 'associationId',
		type: 'string',
		description: 'Association UUID',
	})
	@ApiBody({
		type: UpdateAgentCompanyAssociationDto,
		description: 'Update data',
	})
	@ApiResponse({
		status: 200,
		description: 'Association updated successfully',
		type: AgentCompanyAssociationResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or association not found',
	})
	async update(
		@Agent() agent: AgentType,
		@Param(
			'associationId',
			new ZodValidationPipe(
				AgentCompanyAssociationIdParamSchema.shape.id,
				'agent.company_association.validation',
			),
		)
		associationId: string,
		@Body(
			new ZodValidationPipe(
				UpdateAgentCompanyAssociationSchema,
				'agent.company_association.validation',
			),
		)
		body: UpdateAgentCompanyAssociationDto,
	): Promise<AgentCompanyAssociationResponseDto> {
		// Verify association exists and belongs to this agent
		const existing = await this.service.findById(associationId);
		if (existing.agentId !== agent.id) {
			throw new NotFoundException({
				message: `Association with id '${associationId}' not found for agent '${agent.id}'`,
				i18nType: 'agent.company_association.not_found',
			});
		}

		return this.service.update(associationId, body) as Promise<AgentCompanyAssociationResponseDto>;
	}
}
