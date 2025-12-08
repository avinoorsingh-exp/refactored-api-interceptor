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
import { CreateStateInputSchema, UpdateStateInputSchema, StateIdParamSchema } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { StatesService } from './states.service.js';
import { CreateStateDto } from './dto/create-state.dto.js';
import { UpdateStateDto } from './dto/update-state.dto.js';
import { StateIdParamDto } from './dto/state-id-param.dto.js';
import { StateResponseDto } from './dto/state-response.dto.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';

/**
 * Controller for State entity endpoints.
 * Handles HTTP requests related to state operations.
 * 
 * Note: Metadata endpoint is handled by MetadataController at GET /v1/states/metadata
 */
@ApiTags('states')
@Controller('v1/states')
export class StatesController {
	private readonly logger = new Logger(StatesController.name);

	constructor(private readonly statesService: StatesService) {}

	/**
	 * Creates a new state.
	 * POST /v1/states
	 *
	 * @param body - State data to create
	 * @param res - Express response object for setting Location header
	 * @param req - Express request object for correlation ID
	 * @returns The created state with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new state',
		description: 'Creates a new state with a unique code.',
	})
	@ApiBody({
		type: CreateStateDto,
		description: 'State data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'State created successfully',
		type: StateResponseDto,
		headers: {
			Location: {
				description: 'URL of the created state',
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
		description: 'Conflict - duplicate code',
	})
	async create(
		@Body(
			new ZodValidationPipe(
				CreateStateInputSchema,
				'agent.state.validation',
			),
		)
		body: CreateStateDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<StateResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] POST /v1/states - Creating state: ${body.code}`,
		);

		try {
			const state = await this.statesService.create(body as any);

			// Set Location header
			res.setHeader('Location', `/v1/states/${state.id}`);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/states - 201 Created (${duration}ms) - State: ${state.code}`,
			);

			return state;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/states - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/states - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of states.
	 * GET /v1/states?offset={n}&limit={m}
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of states with metadata
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List states with pagination, filtering, sorting, and search',
		description: 'Retrieves a paginated list of states. Default sort: name ASC. Supports filtering, sorting, and search on name, code fields.',
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
	@ApiResponse({
		status: 200,
		description: 'States retrieved successfully',
		type: [StateResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of states',
				schema: { type: 'string' },
			},
			'Link': {
				description: 'RFC 8288 pagination links (rel=next, rel=prev, rel=first, rel=last)',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - invalid query parameters',
	})
	@UseInterceptors(PaginationInterceptor)
	async findAll(
		@Query() query: any,
		@Req() req: Request,
	): Promise<{ items: StateResponseDto[]; total: number }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/states - List states (offset=${query.offset || 0}, limit=${query.limit || 25}, ` +
			`filter=${query.filter ? 'yes' : 'no'}, sort=${query.sort ? 'yes' : 'no'}, search=${query.search ? 'yes' : 'no'}, ` +
			`include=${query.include || 'none'})`,
		);

		try {
			// Extract field selection from query
			const selection = {
				fields: query.fields?.split(',').map((f: string) => f.trim()),
				include: query.include?.split(',').map((r: string) => r.trim()),
			};

			const { states, total } = await this.statesService.findPage(query, selection);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/states - 200 OK (${duration}ms) - Returned ${states.length} of ${total} states`,
			);

			return { items: states, total };
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/states - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/states - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves a state by its UUID.
	 * GET /v1/states/{id}
	 *
	 * @param params - Path parameters containing state ID
	 * @param req - Express request object for correlation ID
	 * @returns The state resource
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get a state by ID',
		description: 'Retrieves a state by its UUID.',
	})
	@ApiParam({
		name: 'id',
		description: 'State UUID',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'State retrieved successfully',
		type: StateResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - invalid UUID format',
	})
	@ApiResponse({
		status: 404,
		description: 'State not found',
	})
	async findById(
		@Param(new ZodValidationPipe(StateIdParamSchema, 'agent.state.validation'))
		params: StateIdParamDto,
		@Req() req: Request,
	): Promise<StateResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/states/${params.id} - Retrieving state`,
		);

		try {
			const state = await this.statesService.findById(params.id);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/states/${params.id} - 200 OK (${duration}ms) - State: ${state.code}`,
			);

			return state;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/states/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/states/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Updates an existing state by ID.
	 * PUT /v1/states/:id
	 *
	 * @param params - Path parameters containing state ID
	 * @param body - State data to update
	 * @param req - Express request object for correlation ID
	 * @returns The updated state with 200 status
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update a state by ID',
		description: 'Updates an existing state. Returns 404 if not found, 409 if code conflicts.',
	})
	@ApiParam({
		name: 'id',
		description: 'State ID',
		type: 'string',
		format: 'uuid',
	})
	@ApiBody({
		type: UpdateStateDto,
		description: 'State data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'State updated successfully',
		type: StateResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Not found - state with given ID does not exist',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate code',
	})
	async update(
		@Param(new ZodValidationPipe(StateIdParamSchema, 'agent.state.validation'))
		params: StateIdParamDto,
		@Body(
			new ZodValidationPipe(
				UpdateStateInputSchema,
				'agent.state.validation',
			),
		)
		body: UpdateStateDto,
		@Req() req: Request,
	): Promise<StateResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] PUT /v1/states/${params.id} - Updating state`,
		);

		try {
			const state = await this.statesService.update(params.id, body as any);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] PUT /v1/states/${params.id} - 200 OK (${duration}ms) - State: ${state.code}`,
			);

			return state;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] PUT /v1/states/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] PUT /v1/states/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Extracts or generates a correlation ID for request tracing.
	 * 
	 * @param req - Express request object
	 * @returns Correlation ID from header or newly generated UUID
	 */
	private getCorrelationId(req: Request): string {
		const correlationId =
			(req.headers['x-correlation-id'] as string) ||
			(req.headers['x-request-id'] as string) ||
			this.generateCorrelationId();

		return correlationId;
	}

	/**
	 * Generates a simple correlation ID.
	 * 
	 * @returns A simple correlation ID
	 */
	private generateCorrelationId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
	}
}
