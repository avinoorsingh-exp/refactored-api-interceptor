import {
	Controller,
	Get,
	Param,
	Query,
	Logger,
	UseInterceptors,
	HttpException,
	NotFoundException,
	Req,
} from '@nestjs/common'
import { Request } from 'express'
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import { CurrencyIdParamSchema } from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js'
import { CurrenciesService } from './currencies.service.js'
import { CurrencyResponseDto, CurrencyIdParamDto } from './dto/index.js'

/**
 * Controller for Currency resource endpoints.
 * Handles HTTP requests for currency operations (read-only).
 */
@ApiTags('currencies')
@Controller('/v1/currencies')
export class CurrenciesController {
	private readonly logger = new Logger(CurrenciesController.name)

	constructor(private readonly currenciesService: CurrenciesService) {}

	/**
	 * GET /v1/currencies - List currencies with pagination, filtering, sorting, and search
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of currencies with metadata
	 */
	@Get()
	@ApiOperation({
		summary: 'List currencies with pagination, filtering, sorting, and search',
		description:
			'Returns a paginated list of ISO 4217 currencies. Default sort: name ASC. Supports filtering, sorting, and search across code, number, name fields. Max limit is 50.',
	})
	@ApiResponse({
		status: 200,
		description: 'Currencies retrieved successfully',
		type: [CurrencyResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of currencies',
				schema: { type: 'string' },
			},
			Link: {
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
	): Promise<{ items: CurrencyResponseDto[]; total: number }> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] GET /v1/currencies - List currencies (offset=${query.offset || 0}, limit=${query.limit || 25}, ` +
				`filter=${query.filter ? 'yes' : 'no'}, sort=${query.sort ? 'yes' : 'no'}, search=${query.search ? 'yes' : 'no'})`,
		)

		try {
			const { currencies, total } = await this.currenciesService.findPage(query)

			const items = currencies

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] GET /v1/currencies - 200 OK (${duration}ms) - Returned ${items.length} of ${total} currencies`,
			)

			return { items, total }
		} catch (error) {
			const duration = Date.now() - startTime

			if (error instanceof HttpException) {
				const status = error.getStatus()
				this.logger.warn(
					`[${correlationId}] GET /v1/currencies - ${status} ${error.message} (${duration}ms)`,
				)
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/currencies - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				)
			}

			throw error
		}
	}

	/**
	 * GET /v1/currencies/:id - Get a currency by ID
	 *
	 * @param params - Path parameters containing the currency ID
	 * @param req - Express request object for correlation ID
	 * @returns The currency resource
	 * @throws NotFoundException if currency is not found
	 */
	@Get(':id')
	@ApiOperation({
		summary: 'Get a currency by ID',
		description: 'Returns a single ISO 4217 currency by its ID.',
	})
	@ApiParam({
		name: 'id',
		description: 'Currency ID',
		type: 'number',
		example: 1,
	})
	@ApiResponse({
		status: 200,
		description: 'Currency retrieved successfully',
		type: CurrencyResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Currency not found',
	})
	async findById(
		@Param(new ZodValidationPipe(CurrencyIdParamSchema, 'currency.validation'))
		params: CurrencyIdParamDto,
		@Req() req: Request,
	): Promise<CurrencyResponseDto> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(`[${correlationId}] GET /v1/currencies/${params.id} - Retrieving currency`)

		try {
			const currency = await this.currenciesService.findById(params.id)

			if (!currency) {
				throw new NotFoundException({
					message: `Currency with ID '${params.id}' not found`,
					i18nType: 'currency.not_found',
				})
			}

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] GET /v1/currencies/${params.id} - 200 OK (${duration}ms) - Currency: ${currency.code}`,
			)

			return currency
		} catch (error) {
			const duration = Date.now() - startTime

			if (error instanceof HttpException) {
				const status = error.getStatus()
				this.logger.warn(
					`[${correlationId}] GET /v1/currencies/${params.id} - ${status} ${error.message} (${duration}ms)`,
				)
			} else {
				this.logger.error(
					`[${correlationId}] GET /v1/currencies/${params.id} - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				)
			}

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
}
