import {
	Controller,
	Get,
	Post,
	Put,
	Param,
	Query,
	Body,
	Logger,
	UseInterceptors,
	UseGuards,
	HttpCode,
	HttpStatus,
	HttpException,
	NotFoundException,
	Req,
	Res,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import {
	CountryIdParamSchema,
	CountrySystemParamSchema,
	CreateSystemInputSchema,
	UpdateSystemInputSchema,
} from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js'
import { PaginationInterceptor } from '../../../common/pagination/pagination.interceptor.js'
import { CountryExistsGuard } from '../../../common/guards/country-exists.guard.js'
import { SystemsService } from './systems.service.js'
import {
	SystemResponseDto,
	CreateSystemDto,
	UpdateSystemDto,
	CountrySystemParamDto,
	CountryIdParamDto,
} from './dto/index.js'
import { CurrencyResponseDto } from '../../currencies/dto/index.js'

/**
 * Controller for System resource endpoints nested under countries.
 * Handles HTTP requests for system operations.
 */
@ApiTags('systems')
@Controller('/v1/countries/:countryId/systems')
@UseGuards(CountryExistsGuard)
export class SystemsController {
	private readonly logger = new Logger(SystemsController.name)

	constructor(private readonly systemsService: SystemsService) {}

	/**
	 * GET /v1/countries/:countryId/systems - List systems for a country
	 */
	@Get()
	@ApiOperation({
		summary: 'List systems for a country',
		description:
			'Returns a paginated list of systems for the specified country. Default sort: description ASC.',
	})
	@ApiParam({
		name: 'countryId',
		description: 'Country ID',
		type: 'number',
		example: 1,
	})
	@ApiResponse({
		status: 200,
		description: 'Systems retrieved successfully',
		type: [SystemResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of systems',
				schema: { type: 'string' },
			},
			Link: {
				description: 'RFC 8288 pagination links',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 404,
		description: 'Country not found',
	})
	@UseInterceptors(PaginationInterceptor)
	async findAll(
		@Param(new ZodValidationPipe(CountryIdParamSchema, 'country.validation'))
		params: CountryIdParamDto,
		@Query() query: any,
		@Req() req: Request,
	): Promise<{ items: SystemResponseDto[]; total: number }> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] GET /v1/countries/${params.countryId}/systems - List systems`,
		)

		try {
			const { systems, total } = await this.systemsService.findPageByCountry(
				params.countryId,
				query,
			)

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] GET /v1/countries/${params.countryId}/systems - 200 OK (${duration}ms) - Returned ${systems.length} of ${total} systems`,
			)

			return { items: systems, total }
		} catch (error) {
			const duration = Date.now() - startTime
			this.logError(
				correlationId,
				`GET /v1/countries/${params.countryId}/systems`,
				error,
				duration,
			)
			throw error
		}
	}

	/**
	 * GET /v1/countries/:countryId/systems/:systemId - Get a system by ID
	 */
	@Get(':systemId')
	@ApiOperation({
		summary: 'Get a system by ID',
		description: 'Returns a single system by its ID within the specified country.',
	})
	@ApiParam({
		name: 'countryId',
		description: 'Country ID',
		type: 'number',
		example: 1,
	})
	@ApiParam({
		name: 'systemId',
		description: 'System ID',
		type: 'string',
		example: '1',
	})
	@ApiResponse({
		status: 200,
		description: 'System retrieved successfully',
		type: SystemResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Country or system not found',
	})
	async findById(
		@Param(new ZodValidationPipe(CountrySystemParamSchema, 'system.validation'))
		params: CountrySystemParamDto,
		@Req() req: Request,
	): Promise<SystemResponseDto> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] GET /v1/countries/${params.countryId}/systems/${params.systemId}`,
		)

		try {
			const system = await this.systemsService.findByIdInCountry(
				params.countryId,
				params.systemId,
			)

			if (!system) {
				throw new NotFoundException({
					message: `System with ID '${params.systemId}' not found in country ${params.countryId}`,
					i18nType: 'system.not_found',
				})
			}

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] GET /v1/countries/${params.countryId}/systems/${params.systemId} - 200 OK (${duration}ms)`,
			)

			return system
		} catch (error) {
			const duration = Date.now() - startTime
			this.logError(
				correlationId,
				`GET /v1/countries/${params.countryId}/systems/${params.systemId}`,
				error,
				duration,
			)
			throw error
		}
	}

	/**
	 * POST /v1/countries/:countryId/systems - Create a new system
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new system',
		description: 'Creates a new system for the specified country.',
	})
	@ApiParam({
		name: 'countryId',
		description: 'Country ID',
		type: 'number',
		example: 1,
	})
	@ApiResponse({
		status: 201,
		description: 'System created successfully',
		type: SystemResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error or currency not found',
	})
	@ApiResponse({
		status: 404,
		description: 'Country not found',
	})
	async create(
		@Param(new ZodValidationPipe(CountryIdParamSchema, 'country.validation'))
		params: CountryIdParamDto,
		@Body(new ZodValidationPipe(CreateSystemInputSchema, 'system.validation'))
		createSystemDto: CreateSystemDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<SystemResponseDto> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] POST /v1/countries/${params.countryId}/systems - Creating system`,
		)

		try {
			const system = await this.systemsService.create(params.countryId, createSystemDto)

			// Set Location header
			res.setHeader('Location', `/v1/countries/${params.countryId}/systems/${system.id}`)

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] POST /v1/countries/${params.countryId}/systems - 201 Created (${duration}ms) - System: ${system.id}`,
			)

			return system
		} catch (error) {
			const duration = Date.now() - startTime
			this.logError(
				correlationId,
				`POST /v1/countries/${params.countryId}/systems`,
				error,
				duration,
			)
			throw error
		}
	}

	/**
	 * PUT /v1/countries/:countryId/systems/:systemId - Update a system
	 */
	@Put(':systemId')
	@ApiOperation({
		summary: 'Update a system',
		description: 'Updates an existing system for the specified country.',
	})
	@ApiParam({
		name: 'countryId',
		description: 'Country ID',
		type: 'number',
		example: 1,
	})
	@ApiParam({
		name: 'systemId',
		description: 'System ID',
		type: 'string',
		example: '1',
	})
	@ApiResponse({
		status: 200,
		description: 'System updated successfully',
		type: SystemResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error or currency not found',
	})
	@ApiResponse({
		status: 404,
		description: 'Country or system not found',
	})
	async update(
		@Param(new ZodValidationPipe(CountrySystemParamSchema, 'system.validation'))
		params: CountrySystemParamDto,
		@Body(new ZodValidationPipe(UpdateSystemInputSchema, 'system.validation'))
		updateSystemDto: UpdateSystemDto,
		@Req() req: Request,
	): Promise<SystemResponseDto> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] PUT /v1/countries/${params.countryId}/systems/${params.systemId} - Updating system`,
		)

		try {
			const system = await this.systemsService.update(
				params.countryId,
				params.systemId,
				updateSystemDto,
			)

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] PUT /v1/countries/${params.countryId}/systems/${params.systemId} - 200 OK (${duration}ms)`,
			)

			return system
		} catch (error) {
			const duration = Date.now() - startTime
			this.logError(
				correlationId,
				`PUT /v1/countries/${params.countryId}/systems/${params.systemId}`,
				error,
				duration,
			)
			throw error
		}
	}

	/**
	 * GET /v1/countries/:countryId/systems/:systemId/currencies - Get system's currency
	 */
	@Get(':systemId/currencies')
	@ApiOperation({
		summary: "Get a system's currency",
		description: 'Returns the currency used by the specified system.',
	})
	@ApiParam({
		name: 'countryId',
		description: 'Country ID',
		type: 'number',
		example: 1,
	})
	@ApiParam({
		name: 'systemId',
		description: 'System ID',
		type: 'string',
		example: '1',
	})
	@ApiResponse({
		status: 200,
		description: 'Currency retrieved successfully',
		type: CurrencyResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Country, system, or currency not found',
	})
	async getCurrency(
		@Param(new ZodValidationPipe(CountrySystemParamSchema, 'system.validation'))
		params: CountrySystemParamDto,
		@Req() req: Request,
	): Promise<CurrencyResponseDto> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] GET /v1/countries/${params.countryId}/systems/${params.systemId}/currencies`,
		)

		try {
			const currency = await this.systemsService.getCurrency(
				params.countryId,
				params.systemId,
			)

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] GET /v1/countries/${params.countryId}/systems/${params.systemId}/currencies - 200 OK (${duration}ms) - Currency: ${currency.code}`,
			)

			return currency
		} catch (error) {
			const duration = Date.now() - startTime
			this.logError(
				correlationId,
				`GET /v1/countries/${params.countryId}/systems/${params.systemId}/currencies`,
				error,
				duration,
			)
			throw error
		}
	}

	/**
	 * Extracts or generates a correlation ID for request tracing.
	 */
	private getCorrelationId(req: Request): string {
		const correlationId =
			(req.headers['x-correlation-id'] as string) ||
			(req.headers['x-request-id'] as string) ||
			this.generateCorrelationId()

		return correlationId
	}

	/**
	 * Generates a simple correlation ID.
	 */
	private generateCorrelationId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
	}

	/**
	 * Logs errors consistently.
	 */
	private logError(correlationId: string, route: string, error: unknown, duration: number): void {
		if (error instanceof HttpException) {
			const status = error.getStatus()
			this.logger.warn(`[${correlationId}] ${route} - ${status} ${error.message} (${duration}ms)`)
		} else {
			this.logger.error(
				`[${correlationId}] ${route} - 500 Internal Server Error (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)
		}
	}
}
