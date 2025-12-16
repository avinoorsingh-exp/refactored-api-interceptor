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
import { CreateOfficeInputSchema, UpdateOfficeInputSchema, OfficeIdParamSchema } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { OfficesService } from './offices.service.js';
import { CreateOfficeDto } from './dto/create-office.dto.js';
import { UpdateOfficeDto } from './dto/update-office.dto.js';
import { OfficeIdParamDto } from './dto/office-id-param.dto.js';
import { OfficeResponseDto } from './dto/office-response.dto.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';

/**
 * Controller for Office entity endpoints.
 * Handles HTTP requests related to office operations.
 * 
 * Note: Metadata endpoint is handled by MetadataController at GET /v1/offices/metadata
 */
@ApiTags('offices')
@Controller('v1/offices')
export class OfficesController {
	private readonly logger = new Logger(OfficesController.name);

	constructor(private readonly officesService: OfficesService) {}

	/**
	 * Creates a new office.
	 * POST /v1/offices
	 *
	 * @param body - Office data to create
	 * @param res - Express response object for setting Location header
	 * @param req - Express request object for correlation ID
	 * @returns The created office with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new office',
		description: 'Creates a new office with a unique name.',
	})
	@ApiBody({
		type: CreateOfficeDto,
		description: 'Office data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Office created successfully',
		type: OfficeResponseDto,
		headers: {
			Location: {
				description: 'URL of the created office',
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
		description: 'Conflict - duplicate name',
	})
	async create(
		@Body(
			new ZodValidationPipe(
				CreateOfficeInputSchema,
				'agent.office.validation',
			),
		)
		body: CreateOfficeDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<OfficeResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] POST /v1/offices - Creating office: ${body.name}`,
		);

		try {
			const office = await this.officesService.create(body as any);

			// Set Location header
			res.setHeader('Location', `/v1/offices/${office.id}`);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/offices - 201 Created (${duration}ms) - Office: ${office.name}`,
			);

			return office;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/offices - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/offices - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of offices.
	 * GET /v1/offices?offset={n}&limit={m}
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of offices with metadata
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List offices with pagination, filtering, sorting, and search',
		description: 'Retrieves a paginated list of offices. Default sort: name ASC. Supports filtering, sorting, and search.',
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
		description: 'Offices retrieved successfully',
		type: [OfficeResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of offices',
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
	): Promise<{ items: OfficeResponseDto[]; total: number }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/offices - Listing offices with query: ${JSON.stringify(query)}`,
		);

		try {
			// Extract field selection from query
			const selection = {
				fields: query.fields?.split(',').map((f: string) => f.trim()),
				include: query.include?.split(',').map((r: string) => r.trim()),
			};

			const result = await this.officesService.findAll(query, selection);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/offices - 200 OK (${duration}ms) - Retrieved ${result.data.length} of ${result.total} offices`,
			);

			return { items: result.data, total: result.total };
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/offices - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/offices - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves an office by ID.
	 * GET /v1/offices/:id
	 *
	 * @param params - Path parameters containing the office ID
	 * @param req - Express request object for correlation ID
	 * @returns The office entity
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get an office by ID',
		description: 'Retrieves a single office by its ID (bigint).',
	})
	@ApiParam({
		name: 'id',
		description: 'Office ID (bigint as string)',
		type: String,
	})
	@ApiResponse({
		status: 200,
		description: 'Office retrieved successfully',
		type: OfficeResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Office not found',
	})
	async findById(
		@Param(
			new ZodValidationPipe(
				OfficeIdParamSchema,
				'agent.office.validation',
			),
		)
		params: OfficeIdParamDto,
		@Req() req: Request,
	): Promise<OfficeResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/offices/${params.id} - Retrieving office`,
		);

		try {
			const office = await this.officesService.findById(params.id);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/offices/${params.id} - 200 OK (${duration}ms) - Office: ${office.name}`,
			);

			return office;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/offices/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/offices/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Updates an office by ID.
	 * PUT /v1/offices/:id
	 *
	 * @param params - Path parameters containing the office ID
	 * @param body - Office data to update
	 * @param req - Express request object for correlation ID
	 * @returns The updated office entity
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update an office by ID',
		description: 'Updates an existing office. All fields are optional for partial updates.',
	})
	@ApiParam({
		name: 'id',
		description: 'Office ID (bigint as string)',
		type: String,
	})
	@ApiBody({
		type: UpdateOfficeDto,
		description: 'Office data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Office updated successfully',
		type: OfficeResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Office not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name',
	})
	async update(
		@Param(
			new ZodValidationPipe(
				OfficeIdParamSchema,
				'agent.office.validation',
			),
		)
		params: OfficeIdParamDto,
		@Body(
			new ZodValidationPipe(
				UpdateOfficeInputSchema,
				'agent.office.validation',
			),
		)
		body: UpdateOfficeDto,
		@Req() req: Request,
	): Promise<OfficeResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] PUT /v1/offices/${params.id} - Updating office`,
		);

		try {
			const office = await this.officesService.update(params.id, body as any);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] PUT /v1/offices/${params.id} - 200 OK (${duration}ms) - Office: ${office.name}`,
			);

			return office;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] PUT /v1/offices/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] PUT /v1/offices/${params.id} - 500 Internal Server Error (${duration}ms)`,
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
