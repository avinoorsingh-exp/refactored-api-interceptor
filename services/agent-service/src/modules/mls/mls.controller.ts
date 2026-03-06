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
import { CreateMLSInputSchema, UpdateMLSInputSchema, MLSIdParamSchema } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { MLSService } from './mls.service.js';
import { CreateMLSDto } from './dto/create-mls.dto.js';
import { UpdateMLSDto } from './dto/update-mls.dto.js';
import { MLSIdParamDto } from './dto/mls-id-param.dto.js';
import { MLSResponseDto } from './dto/mls-response.dto.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';

/**
 * Controller for MLS entity endpoints.
 * Handles HTTP requests related to MLS operations.
 * 
 * Note: Metadata endpoint is handled by MetadataController at GET /v1/mls/metadata
 */
@ApiTags('mls')
@Controller('v1/mls')
export class MLSController {
	private readonly logger = new Logger(MLSController.name);

	constructor(private readonly mlsService: MLSService) {}

	/**
	 * Creates a new MLS.
	 * POST /v1/mls
	 *
	 * @param body - MLS data to create
	 * @param res - Express response object for setting Location header
	 * @param req - Express request object for correlation ID
	 * @returns The created MLS with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new MLS',
		description: 'Creates a new MLS with a unique name.',
	})
	@ApiBody({
		type: CreateMLSDto,
		description: 'MLS data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'MLS created successfully',
		type: MLSResponseDto,
		headers: {
			Location: {
				description: 'URL of the created MLS',
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
		description: 'Conflict - duplicate name or global_id',
	})
	async create(
		@Body(
			new ZodValidationPipe(
				CreateMLSInputSchema,
				'agent.mls.validation',
			),
		)
		body: CreateMLSDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<MLSResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] POST /v1/mls - Creating MLS: ${body.name}`,
		);

		try {
			const mls = await this.mlsService.create(body as any);

			// Set Location header
			res.setHeader('Location', `/v1/mls/${mls.id}`);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/mls - 201 Created (${duration}ms) - MLS: ${mls.name}`,
			);

			return mls;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/mls - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/mls - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of MLS records.
	 * GET /v1/mls?offset={n}&limit={m}
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of MLS records with metadata
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List MLS records with pagination, filtering, sorting, and search',
		description: 'Retrieves a paginated list of MLS records. Default sort: name ASC. Supports filtering, sorting, and search.',
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
		description: 'MLS records retrieved successfully',
		type: [MLSResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of MLS records',
				schema: { type: 'string' },
			},
			'Link': {
				description: 'RFC 8288 pagination links',
				schema: { type: 'string' },
			},
		},
	})
	@UseInterceptors(PaginationInterceptor)
	async findAll(
		@Query() query: any,
		@Req() req: Request,
	): Promise<{ items: MLSResponseDto[]; total: number }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/mls - Listing MLS records with query: ${JSON.stringify(query)}`,
		);

		try {
			// Extract field selection from query
			const selection = {
				fields: query.fields?.split(',').map((f: string) => f.trim()),
				include: query.include?.split(',').map((r: string) => r.trim()),
			};

			const result = await this.mlsService.findAll(query, selection);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/mls - 200 OK (${duration}ms) - Retrieved ${result.data.length} of ${result.total} MLS records`,
			);

			return { items: result.data, total: result.total };
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/mls - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/mls - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves an MLS by ID.
	 * GET /v1/mls/:id
	 *
	 * @param params - Path parameters containing the MLS ID
	 * @param req - Express request object for correlation ID
	 * @returns The MLS entity
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get an MLS by ID',
		description: 'Retrieves a single MLS by its ID (bigint).',
	})
	@ApiParam({
		name: 'id',
		description: 'MLS ID (bigint as string)',
		type: String,
	})
	@ApiResponse({
		status: 200,
		description: 'MLS retrieved successfully',
		type: MLSResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'MLS not found',
	})
	async findById(
		@Param(
			new ZodValidationPipe(
				MLSIdParamSchema,
				'agent.mls.validation',
			),
		)
		params: MLSIdParamDto,
		@Req() req: Request,
	): Promise<MLSResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/mls/${params.id} - Retrieving MLS`,
		);

		try {
			const mls = await this.mlsService.findById(params.id);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/mls/${params.id} - 200 OK (${duration}ms) - MLS: ${mls.name}`,
			);

			return mls;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/mls/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/mls/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Updates an MLS by ID.
	 * PUT /v1/mls/:id
	 *
	 * @param params - Path parameters containing the MLS ID
	 * @param body - MLS data to update
	 * @param req - Express request object for correlation ID
	 * @returns The updated MLS entity
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update an MLS by ID',
		description: 'Updates an existing MLS. All fields are optional for partial updates.',
	})
	@ApiParam({
		name: 'id',
		description: 'MLS ID (bigint as string)',
		type: String,
	})
	@ApiBody({
		type: UpdateMLSDto,
		description: 'MLS data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'MLS updated successfully',
		type: MLSResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'MLS not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name or global_id',
	})
	async update(
		@Param(
			new ZodValidationPipe(
				MLSIdParamSchema,
				'agent.mls.validation',
			),
		)
		params: MLSIdParamDto,
		@Body(
			new ZodValidationPipe(
				UpdateMLSInputSchema,
				'agent.mls.validation',
			),
		)
		body: UpdateMLSDto,
		@Req() req: Request,
	): Promise<MLSResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] PUT /v1/mls/${params.id} - Updating MLS`,
		);

		try {
			const mls = await this.mlsService.update(params.id, body as any);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] PUT /v1/mls/${params.id} - 200 OK (${duration}ms) - MLS: ${mls.name}`,
			);

			return mls;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] PUT /v1/mls/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] PUT /v1/mls/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Extracts correlation ID from request headers.
	 * Falls back to generating a new ID if not present.
	 */
	private getCorrelationId(req: Request): string {
		return (
			(req.headers['x-correlation-id'] as string) ||
			(req.headers['x-request-id'] as string) ||
			`${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
		);
	}
}
