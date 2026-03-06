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
import { z } from 'zod';
import { CreateExternalReferenceInput, UpdateExternalReferenceInput, PaginationQuerySchema, type NormalizedPagination } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js';
import { ExternalReferenceService } from './external-reference.service.js';
import { ExternalReferenceResponseDto, CreateExternalReferenceDto, UpdateExternalReferenceDto } from './dto/index.js';
import { PaginationInterceptor } from '../../../common/pagination/pagination.interceptor.js';
import { LoggerService, ScopedLogger } from '../../../core/logger.service.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import { Agent } from '../../../common/decorators/agent.decorator.js';
import type { Agent as AgentType } from '@exprealty/shared-domain';

const RefIdSchema = z.string().uuid({ message: 'errors.externalReference.id.invalid' });

/**
 * Controller for ExternalReference nested endpoints under Agent.
 * Routes: GET/POST /v1/agents/:id/external-references
 */
@ApiTags('agents > external-references')
@Controller('v1/agents/:id/external-references')
@UseGuards(AgentExistsGuard)
export class ExternalReferenceController {
	private readonly logger: ScopedLogger;

	constructor(
		private readonly service: ExternalReferenceService,
		logger: LoggerService,
	) {
		this.logger = logger.createScopedLogger('ExternalReferenceController');
	}

	@Get()
	@UseInterceptors(PaginationInterceptor)
	@ApiOperation({ summary: 'List external references for an agent' })
	@ApiParam({ name: 'id', type: 'string', description: 'Agent UUID' })
	@ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset (default: 0)' })
	@ApiQuery({ name: 'limit', required: false, type: Number, description: 'Pagination limit (max: 50, default: 25)' })
	@ApiResponse({ status: 200, description: 'List of external references with pagination' })
	@ApiResponse({ status: 404, description: 'Agent not found' })
	async findAll(
		@Agent() agent: AgentType,
		@Query(new ZodValidationPipe(PaginationQuerySchema, 'pagination')) query: NormalizedPagination,
	): Promise<{ items: ExternalReferenceResponseDto[]; total: number }> {
		const result = await this.service.findByAgentId(agent.id, {
			offset: query.offset,
			limit: query.limit,
		});

		return {
			items: result.items as unknown as ExternalReferenceResponseDto[],
			total: result.total,
		};
	}

	@Get(':refId')
	@ApiOperation({ summary: 'Get an external reference by ID' })
	@ApiParam({ name: 'id', type: 'string', description: 'Agent UUID' })
	@ApiParam({ name: 'refId', type: 'string', description: 'External Reference UUID' })
	@ApiResponse({ status: 200, description: 'External reference found', type: ExternalReferenceResponseDto })
	@ApiResponse({ status: 404, description: 'Agent or external reference not found' })
	async findById(
		@Agent() agent: AgentType,
		@Param('refId', new ZodValidationPipe(RefIdSchema, 'externalReference.validation'))
		refId: string,
	): Promise<ExternalReferenceResponseDto> {
		return this.service.findById(agent.id, refId) as unknown as Promise<ExternalReferenceResponseDto>;
	}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: 'Create an external reference for an agent' })
	@ApiParam({ name: 'id', type: 'string', description: 'Agent UUID' })
	@ApiBody({ type: CreateExternalReferenceDto })
	@ApiResponse({ status: 201, description: 'External reference created', type: ExternalReferenceResponseDto,
		headers: { Location: { description: 'URL of the created resource', schema: { type: 'string' } } },
	})
	@ApiResponse({ status: 400, description: 'Validation error' })
	@ApiResponse({ status: 404, description: 'Agent not found' })
	async create(
		@Agent() agent: AgentType,
		@Body(new ZodValidationPipe(CreateExternalReferenceInput, 'externalReference.validation'))
		body: CreateExternalReferenceDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<ExternalReferenceResponseDto> {
		this.logger.operational(`Creating external reference for agent ${agent.id}`);

		const ref = await this.service.create(agent.id, body);

		res.setHeader('Location', `/v1/agents/${agent.id}/external-references/${ref.id}`);

		return ref as unknown as ExternalReferenceResponseDto;
	}

	@Put(':refId')
	@ApiOperation({ summary: 'Update an external reference' })
	@ApiParam({ name: 'id', type: 'string', description: 'Agent UUID' })
	@ApiParam({ name: 'refId', type: 'string', description: 'External Reference UUID' })
	@ApiBody({ type: UpdateExternalReferenceDto })
	@ApiResponse({ status: 200, description: 'External reference updated', type: ExternalReferenceResponseDto })
	@ApiResponse({ status: 400, description: 'Validation error' })
	@ApiResponse({ status: 404, description: 'Agent or external reference not found' })
	async update(
		@Agent() agent: AgentType,
		@Param('refId', new ZodValidationPipe(RefIdSchema, 'externalReference.validation'))
		refId: string,
		@Body(new ZodValidationPipe(UpdateExternalReferenceInput, 'externalReference.validation'))
		body: UpdateExternalReferenceDto,
	): Promise<ExternalReferenceResponseDto> {
		this.logger.operational(`Updating external reference ${refId} for agent ${agent.id}`);

		const ref = await this.service.update(agent.id, refId, body);

		return ref as unknown as ExternalReferenceResponseDto;
	}
}
