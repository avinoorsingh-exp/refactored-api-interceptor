import {
	Controller,
	Get,
	Post,
	Put,
	Param,
	Body,
	Query,
	HttpCode,
	HttpStatus,
	Res,
	Req,
	UseInterceptors,
	HttpException,
} from '@nestjs/common'
import { Request, Response } from 'express'
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiBody,
} from '@nestjs/swagger'
import {
	CompanyIdParamSchema,
	CreateCompanyInputSchema,
	UpdateCompanyInputSchema,
} from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { CompaniesService } from './companies.service.js'
import { PaginationService } from '../../common/pagination/pagination.service.js'
import { CompanyIdParamDto } from './dto/company-id-param.dto.js'
import { CreateCompanyDto } from './dto/create-company.dto.js'
import { UpdateCompanyInputDto } from './dto/update-company-input.dto.js'
import { CompanyResponseDto } from './dto/company-response.dto.js'
import { PaginationQueryDto } from '../../common/pagination/pagination.dto.js'
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js'
import { LoggerService } from '../../core/logger.service.js'

/**
 * Controller for Company entity endpoints.
 * Handles HTTP requests related to company operations.
 * 
 * Note: Metadata endpoint is handled by MetadataController at GET /v1/companies/metadata
 */
@ApiTags('companies')
@Controller('v1/companies')
export class CompaniesController {
	constructor(
		private readonly companiesService: CompaniesService,
		private readonly logger: LoggerService,
	) {}

	/**
	 * Creates a new company.
	 * POST /v1/companies
	 *
	 * @param body - Company data to create
	 * @param res - Express response object for setting Location header
	 * @returns The created company with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new company',
		description: 'Creates a new company with a unique normalized name.',
	})
	@ApiBody({
		type: CreateCompanyDto,
		description: 'Company data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Company created successfully',
		type: CompanyResponseDto,
		headers: {
			Location: {
				description: 'URL of the created company',
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
		description: 'Conflict - duplicate normalized name',
	})
	async create(
		@Body(
			new ZodValidationPipe(
				CreateCompanyInputSchema,
				'agent.company.validation',
			),
		)
		body: CreateCompanyDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<CompanyResponseDto> {
		const company = await this.companiesService.create(body as any)

		// Set Location header
		res.setHeader('Location', `/v1/companies/${company.id}`)

		return company
	}

	/**
	 * Retrieves a paginated list of companies.
	 * GET /v1/companies
	 *
	 * @param query - Pagination query parameters (offset, limit)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of companies with metadata
	 */
	@Get()
	@ApiOperation({
		summary: 'List companies with pagination',
		description: 'Returns a paginated list of companies sorted by name ascending. Supports offset-based pagination with X-Total-Count and Link headers.',
	})
	@ApiResponse({
		status: 200,
		description: 'Companies retrieved successfully',
		type: [CompanyResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of companies',
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
		description: 'Validation error - invalid offset or limit',
	})
	@UseInterceptors(PaginationInterceptor)
	async findAll(
		@Query() query: any, // Accept all query params for filter, sort, search, pagination
		@Req() req: Request,
	): Promise<{ items: CompanyResponseDto[]; total: number }> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.info('GET /v1/companies - List companies with pagination, filter, sort, search', {
			correlationId,
			offset: query.offset,
			limit: query.limit,
			hasFilter: !!query.filter,
			hasSort: !!query.sort,
			hasSearch: !!query.search,
		})

		try {
			// Extract field selection from query
			const selection = {
				fields: query.fields?.split(',').map((f: string) => f.trim()),
				include: query.include?.split(',').map((r: string) => r.trim()),
			}

			// Pass query to service - QueryParamsSchema handles all parsing and validation
			const { companies, total } = await this.companiesService.findPage(query, selection)

			const items = companies

			const duration = Date.now() - startTime
			this.logger.info('GET /v1/companies - Success', {
				correlationId,
				status: 200,
				duration_ms: duration,
				count: items.length,
				total,
				offset: query.offset,
				limit: query.limit,
			})

			return { items, total }
		} catch (error) {
			const duration = Date.now() - startTime

			if (error instanceof HttpException) {
				const status = error.getStatus()
				this.logger.warn('GET /v1/companies - Error', {
					correlationId,
					status,
					duration_ms: duration,
					error: error.message,
				})
			} else {
				this.logger.error('GET /v1/companies - Unexpected error', {
					correlationId,
					status: 500,
					duration_ms: duration,
					error: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined,
				})
			}

			throw error
		}
	}

	/**
	 * Retrieves a company by its UUID.
	 * GET /v1/companies/{id}
	 *
	 * @param params - Path parameters containing company ID
	 * @returns The company entity
	 * @throws NotFoundException if company does not exist
	 */
	@Get(':id')
	@ApiOperation({
		summary: 'Get company by ID',
		description: 'Retrieves a single company by its unique identifier.',
	})
	@ApiParam({
		name: 'id',
		description: 'Company UUID',
		type: String,
	})
	@ApiResponse({
		status: 200,
		description: 'Company retrieved successfully',
		type: CompanyResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Not found - company does not exist',
	})
	async findOne(
		@Param(
			new ZodValidationPipe(CompanyIdParamSchema, 'agent.company.validation'),
		)
		params: CompanyIdParamDto,
		@Query() query: any,
	): Promise<CompanyResponseDto> {
		const selection = {
			fields: query.fields?.split(',').map((f: string) => f.trim()),
			include: query.include?.split(',').map((r: string) => r.trim()),
		}

		const company = await this.companiesService.findById(params.id, selection)

		return company
	}

	/**
	 * Updates an existing company by ID.
	 * PUT /v1/companies/{id}
	 *
	 * @param params - Path parameters containing company ID
	 * @param body - Company data to update
	 * @returns The updated company
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update a company',
		description: 'Updates an existing company by its UUID. Requires all fields (full replacement).',
	})
	@ApiParam({
		name: 'id',
		description: 'Company UUID',
		type: String,
		format: 'uuid',
	})
	@ApiBody({
		type: UpdateCompanyInputDto,
		description: 'Company data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Company updated successfully',
		type: CompanyResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Company not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name or email',
	})
	async update(
		@Param(new ZodValidationPipe(CompanyIdParamSchema, 'agent.company.validation'))
		params: CompanyIdParamDto,
		@Body(new ZodValidationPipe(UpdateCompanyInputSchema, 'agent.company.validation'))
		body: UpdateCompanyInputDto,
	): Promise<CompanyResponseDto> {
		const company = await this.companiesService.update(params.id, body as any)
		
		return company
	}

	/**
	 * Extracts or generates a correlation ID for request tracing.
	 * 
	 * @param req - Express request object
	 * @returns Correlation ID from header or newly generated UUID
	 */
	private getCorrelationId(req: Request): string {
		// Check for common correlation ID headers
		const correlationId =
			(req.headers['x-correlation-id'] as string) ||
			(req.headers['x-request-id'] as string) ||
			this.generateCorrelationId()

		return correlationId
	}

	/**
	 * Generates a simple correlation ID.
	 * In production, use a proper UUID library.
	 * 
	 * @returns A simple correlation ID
	 */
	private generateCorrelationId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
	}
}
