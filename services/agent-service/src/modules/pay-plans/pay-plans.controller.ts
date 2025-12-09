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
import { CreatePayPlanInputSchema, UpdatePayPlanInputSchema, PayPlanIdParamSchema } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { PayPlansService } from './pay-plans.service.js';
import { CreatePayPlanDto } from './dto/create-pay-plan.dto.js';
import { UpdatePayPlanDto } from './dto/update-pay-plan.dto.js';
import { PayPlanIdParamDto } from './dto/pay-plan-id-param.dto.js';
import { PayPlanResponseDto } from './dto/pay-plan-response.dto.js';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';

/**
 * Controller for PayPlan entity endpoints.
 * Handles HTTP requests related to pay plan operations.
 * 
 * Note: Metadata endpoint is handled by MetadataController at GET /v1/payplans/metadata
 */
@ApiTags('payplans')
@Controller('v1/payplans')
export class PayPlansController {
	private readonly logger = new Logger(PayPlansController.name);

	constructor(private readonly payPlansService: PayPlansService) {}

	/**
	 * Creates a new pay plan.
	 * POST /v1/payplans
	 *
	 * @param body - Pay plan data to create
	 * @param res - Express response object for setting Location header
	 * @param req - Express request object for correlation ID
	 * @returns The created pay plan with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new pay plan',
		description: 'Creates a new pay plan with a unique name.',
	})
	@ApiBody({
		type: CreatePayPlanDto,
		description: 'Pay plan data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Pay plan created successfully',
		type: PayPlanResponseDto,
		headers: {
			Location: {
				description: 'URL of the created pay plan',
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
				CreatePayPlanInputSchema,
				'agent.payplan.validation',
			),
		)
		body: CreatePayPlanDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<PayPlanResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] POST /v1/payplans - Creating pay plan: ${body.name}`,
		);

		try {
			const payPlan = await this.payPlansService.create(body as any);

			// Set Location header
			res.setHeader('Location', `/v1/payplans/${payPlan.id}`);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/payplans - 201 Created (${duration}ms) - Pay plan: ${payPlan.name}`,
			);

			return payPlan;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/payplans - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/payplans - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of pay plans.
	 * GET /v1/payplans?offset={n}&limit={m}
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of pay plans with metadata
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List pay plans with pagination, filtering, sorting, and search',
		description: 'Retrieves a paginated list of pay plans. Default sort: name ASC. Supports filtering, sorting, and search on name field.',
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
		name: 'filter',
		description: 'JSON filter conditions',
		required: false,
		type: String,
		example: '{"conditions":[{"field":"active","operator":"eq","value":true}]}',
	})
	@ApiQuery({
		name: 'sort',
		description: 'JSON sort conditions',
		required: false,
		type: String,
		example: '{"conditions":[{"field":"name","direction":"ASC"}]}',
	})
	@ApiQuery({
		name: 'search',
		description: 'Search term for name field',
		required: false,
		type: String,
		example: 'Standard',
	})
	@ApiQuery({
		name: 'fields',
		description: 'Comma-separated list of fields to return',
		required: false,
		type: String,
		example: 'id,name,active,agentPercentage,cap',
	})
	@ApiResponse({
		status: 200,
		description: 'Pay plans retrieved successfully',
		type: [PayPlanResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of pay plans',
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
	): Promise<{ items: PayPlanResponseDto[]; total: number }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/payplans - Listing pay plans with query: ${JSON.stringify(query)}`,
		);

		try {
			// Extract field selection from query
			const selection = {
				fields: query.fields?.split(',').map((f: string) => f.trim()),
				include: query.include?.split(',').map((r: string) => r.trim()),
			};

			const { payPlans, total } = await this.payPlansService.findPage(query, selection);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/payplans - 200 OK (${duration}ms) - Retrieved ${payPlans.length} of ${total} pay plans`,
			);

			return { items: payPlans, total };
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/payplans - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/payplans - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Retrieves a pay plan by ID.
	 * GET /v1/payplans/:id
	 *
	 * @param params - Path parameters containing the pay plan ID
	 * @param req - Express request object for correlation ID
	 * @returns The pay plan entity
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get a pay plan by ID',
		description: 'Retrieves a single pay plan by its UUID.',
	})
	@ApiParam({
		name: 'id',
		description: 'Pay plan UUID',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Pay plan retrieved successfully',
		type: PayPlanResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Pay plan not found',
	})
	async findById(
		@Param(
			new ZodValidationPipe(
				PayPlanIdParamSchema,
				'agent.payplan.validation',
			),
		)
		params: PayPlanIdParamDto,
		@Req() req: Request,
	): Promise<PayPlanResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] GET /v1/payplans/${params.id} - Retrieving pay plan`,
		);

		try {
			const payPlan = await this.payPlansService.findById(params.id);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] GET /v1/payplans/${params.id} - 200 OK (${duration}ms) - Pay plan: ${payPlan.name}`,
			);

			return payPlan;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] GET /v1/payplans/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/payplans/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				);
			}

			throw error;
		}
	}

	/**
	 * Updates a pay plan by ID.
	 * PUT /v1/payplans/:id
	 *
	 * @param params - Path parameters containing the pay plan ID
	 * @param body - Pay plan data to update
	 * @param req - Express request object for correlation ID
	 * @returns The updated pay plan entity
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update a pay plan by ID',
		description: 'Updates an existing pay plan. All fields are optional for partial updates.',
	})
	@ApiParam({
		name: 'id',
		description: 'Pay plan ID',
		type: 'string',
		format: 'uuid',
	})
	@ApiBody({
		type: UpdatePayPlanDto,
		description: 'Pay plan data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Pay plan updated successfully',
		type: PayPlanResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Pay plan not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name',
	})
	async update(
		@Param(
			new ZodValidationPipe(
				PayPlanIdParamSchema,
				'agent.payplan.validation',
			),
		)
		params: PayPlanIdParamDto,
		@Body(
			new ZodValidationPipe(
				UpdatePayPlanInputSchema,
				'agent.payplan.validation',
			),
		)
		body: UpdatePayPlanDto,
		@Req() req: Request,
	): Promise<PayPlanResponseDto> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] PUT /v1/payplans/${params.id} - Updating pay plan`,
		);

		try {
			const payPlan = await this.payPlansService.update(params.id, body as any);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] PUT /v1/payplans/${params.id} - 200 OK (${duration}ms) - Pay plan: ${payPlan.name}`,
			);

			return payPlan;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] PUT /v1/payplans/${params.id} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] PUT /v1/payplans/${params.id} - 500 Internal Server Error (${duration}ms)`,
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
