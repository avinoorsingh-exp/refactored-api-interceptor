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
	Req,
	UseInterceptors,
	HttpException,
	Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';
import { CreateAgentInput, UpdateAgentInput, AgentIdParamSchema } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { isGuestScopeAgentRead } from '../../common/auth/jwt-scope.util.js';
import { AgentService } from './agent.service.js';
import { CreateAgentDto } from './dto/create-agent.dto.js';
import { UpdateAgentDto } from './dto/update-agent.dto.js';
import { AgentIdParamDto } from './dto/agent-id-param.dto.js';
import { AgentResponseDto } from './dto/agent-response.dto.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';

/** When scope is agent-service/read, only these fields and includes are used (client include is ignored). */
const MINIMAL_AGENT_FIELDS = ['id', 'firstName', 'lastName', 'lifecycleStatus'] as const;
const MINIMAL_AGENT_INCLUDES = ['primaryEmail', 'primaryAddress'] as const;

type MinimalAgentItem = {
	id: string;
	firstName: string;
	lastName: string;
	lifecycleStatus: string;
	primaryEmail?: { value: string };
	primaryAddress?: {
		country?: { name: string };
		state?: { name: string };
	};

function mapToMinimalAgentResponse(agent: Record<string, unknown>): MinimalAgentItem {
	const primaryEmail = agent.primaryEmail as { value?: string } | undefined;
	const primaryAddress = agent.primaryAddress as {
		country?: { name?: string };
		state?: { name?: string };
	} | undefined;
	const hasCountry = primaryAddress?.country?.name != null;
	const hasState = primaryAddress?.state?.name != null;
	const primaryAddressPayload =
		primaryAddress != null && (hasCountry || hasState)
			? {
					...(hasCountry && { country: { name: primaryAddress.country!.name } }),
					...(hasState && { state: { name: primaryAddress.state!.name } }),
				}
			: undefined;
	return {
		id: agent.id as string,
		firstName: agent.firstName as string,
		lastName: agent.lastName as string,
		lifecycleStatus: (agent.lifecycleStatus as string) ?? 'Active',
		...(primaryEmail?.value != null && { primaryEmail: { value: primaryEmail.value } }),
		...(primaryAddressPayload && { primaryAddress: primaryAddressPayload }),
	};
}

/**
 * Controller for Agent entity endpoints.
 * Handles HTTP requests related to Agent operations.
 *
 * Note: Metadata endpoint is handled by MetadataController at GET /v1/agents/metadata
 */
@ApiTags('agents')
@Controller('v1/agents')
export class AgentController {
	private readonly logger = new Logger(AgentController.name);

	constructor(private readonly agentService: AgentService) {}

	/**
	 * Creates a new Agent.
	 * POST /v1/agents
	 *
	 * @param body - Agent data to create
	 * @param res - Express response object for setting Location header
	 * @param req - Express request object for correlation ID
	 * @returns The created Agent with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new Agent',
		description: 'Creates a new Agent record.',
	})
	@ApiBody({
		type: CreateAgentDto,
		description: 'Agent data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Agent created successfully',
		type: AgentResponseDto,
		headers: {
			Location: {
				description: 'URL of the created Agent',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate email',
	})
	async create(
		@Body(
			new ZodValidationPipe(
				CreateAgentInput,
				'agent.validation',
			),
		)
		body: CreateAgentDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<AgentResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] POST /v1/agents - Creating Agent: ${body.firstName} ${body.lastName}`,
		);

		try {
			const agent = await this.agentService.create(body as any);

			// Set Location header
			res.setHeader('Location', `/v1/agents/${agent.id}`);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/agents - 201 Created (${duration}ms) - Agent: ${agent.firstName} ${agent.lastName}`,
			);

			return agent as AgentResponseDto;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/agents - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/agents - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of Agent records.
	 * GET /v1/agents?offset={n}&limit={m}
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of Agent records with metadata
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List Agent records with pagination, filtering, sorting, and search',
		description:
			'Retrieves a paginated list of Agent records. Default sort: lastName ASC. Supports filtering, sorting, search, and relation includes.',
	})
	@ApiQuery({
		name: 'offset',
		description: 'Number of records to skip',
		required: false,
		type: Number,
		example: 0,
	})
	@ApiQuery({
		name: 'limit',
		description: 'Maximum number of records to return (max 50)',
		required: false,
		type: Number,
		example: 25,
	})
	@ApiQuery({
		name: 'include',
		description: 'Comma-separated list of relations to include',
		required: false,
		type: String,
		example: 'mls,office,publicProfile',
	})
	@ApiResponse({
		status: 200,
		description: 'Agent records retrieved successfully',
		type: [AgentResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of Agent records',
				schema: { type: 'string' },
			},
			Link: {
				description: 'RFC 8288 pagination links',
				schema: { type: 'string' },
			},
		},
	})
	@UseInterceptors(PaginationInterceptor)
	async findAll(
		@Query() query: any,
		@Req() req: Request,
	): Promise<{ items: AgentResponseDto[]; total: number }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/agents - Listing Agent records with query: ${JSON.stringify(query)}`,
		);

		try {
			// When scope is agent-service/read (guest), ignore client includes and return minimal fields only
			const selection = isGuestScopeAgentRead(req)
				? {
						fields: [...MINIMAL_AGENT_FIELDS],
						include: [...MINIMAL_AGENT_INCLUDES],
					}
				: {
						fields: query.fields?.split(',').map((f: string) => f.trim()),
						include: query.include?.split(',').map((r: string) => r.trim()),
					};

			const result = await this.agentService.findAll(query, selection);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/agents - 200 OK (${duration}ms) - Retrieved ${result.data.length} of ${result.total} Agent records`,
			);

			const items = isGuestScopeAgentRead(req)
				? result.data.map((a) => mapToMinimalAgentResponse(a as Record<string, unknown>))
				: (result.data as AgentResponseDto[]);

			return { items, total: result.total };
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/agents - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/agents - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves an Agent by ID.
	 * GET /v1/agents/:id
	 *
	 * @param params - Path parameters containing the Agent ID
	 * @param query - Query parameters for field selection and includes
	 * @param req - Express request object for correlation ID
	 * @returns The Agent entity
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get an Agent by ID',
		description: 'Retrieves a single Agent by its UUID.',
	})
	@ApiParam({
		name: 'id',
		description: 'Agent ID (UUID)',
		type: String,
	})
	@ApiQuery({
		name: 'fields',
		description: 'Comma-separated list of fields to return',
		required: false,
		type: String,
		example: 'id,firstName,lastName,email',
	})
	@ApiQuery({
		name: 'include',
		description: 'Comma-separated list of relations to include',
		required: false,
		type: String,
		example: 'mls,office,publicProfile',
	})
	@ApiResponse({
		status: 200,
		description: 'Agent retrieved successfully',
		type: AgentResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async findById(
		@Param(
			new ZodValidationPipe(
				AgentIdParamSchema,
				'agent.validation',
			),
		)
		params: AgentIdParamDto,
		@Query() query: any,
		@Req() req: Request,
	): Promise<AgentResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/agents/${params.id} - Retrieving Agent`,
		);

		try {
			// When scope is agent-service/read (guest), ignore client includes and return minimal fields only
			const selection = isGuestScopeAgentRead(req)
				? {
						fields: [...MINIMAL_AGENT_FIELDS],
						include: [...MINIMAL_AGENT_INCLUDES],
					}
				: {
						fields: query.fields?.split(',').map((f: string) => f.trim()),
						include: query.include?.split(',').map((r: string) => r.trim()),
					};

			const agent = await this.agentService.findById(params.id, selection);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/agents/${params.id} - 200 OK (${duration}ms) - Agent: ${agent.firstName} ${agent.lastName}`,
			);

			if (isGuestScopeAgentRead(req)) {
				return mapToMinimalAgentResponse(agent as unknown as Record<string, unknown>) as AgentResponseDto;
			}
			return agent as AgentResponseDto;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/agents/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/agents/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Updates an Agent by ID.
	 * PUT /v1/agents/:id
	 *
	 * @param params - Path parameters containing the Agent ID
	 * @param body - Agent data to update
	 * @param req - Express request object for correlation ID
	 * @returns The updated Agent entity
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update an Agent by ID',
		description: 'Updates an existing Agent. All fields are optional for partial updates.',
	})
	@ApiParam({
		name: 'id',
		description: 'Agent ID (UUID)',
		type: String,
	})
	@ApiBody({
		type: UpdateAgentDto,
		description: 'Agent data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Agent updated successfully',
		type: AgentResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate email',
	})
	async update(
		@Param(
			new ZodValidationPipe(
				AgentIdParamSchema,
				'agent.validation',
			),
		)
		params: AgentIdParamDto,
		@Body(
			new ZodValidationPipe(
				UpdateAgentInput,
				'agent.validation',
			),
		)
		body: UpdateAgentDto,
		@Req() req: Request,
	): Promise<AgentResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] PUT /v1/agents/${params.id} - Updating Agent`,
		);

		try {
			const agent = await this.agentService.update(params.id, body as any);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] PUT /v1/agents/${params.id} - 200 OK (${duration}ms) - Agent: ${agent.firstName} ${agent.lastName}`,
			);

			return agent as AgentResponseDto;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] PUT /v1/agents/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] PUT /v1/agents/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Extracts correlation ID from request headers.
	 */
	private getCorrelationId(req: Request): string {
		return (req.headers['x-correlation-id'] as string) || 'unknown';
	}
}
