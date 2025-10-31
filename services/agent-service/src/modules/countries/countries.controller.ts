import {
	Controller,
	Post,
	Body,
	HttpCode,
	HttpStatus,
	Logger,
	UsePipes,
	HttpException,
	Res,
	Req,
} from '@nestjs/common'
import { Response, Request } from 'express'
import { CreateCountryInputSchema } from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { CountriesService } from './countries.service.js'
import { CreateCountryDto } from './dto/create-country.dto.js'
import { CountryResponseDto } from './dto/country-response.dto.js'

/**
 * Controller for Country resource endpoints.
 * Handles HTTP requests for country operations.
 */
@Controller('/v1/countries')
export class CountriesController {
	private readonly logger = new Logger(CountriesController.name)

	constructor(private readonly countriesService: CountriesService) {}

	/**
	 * POST /v1/countries - Create a new country
	 * 
	 * @param createCountryDto - Country data from request body (validated by Zod)
	 * @param res - Express response object for setting headers
	 * @param req - Express request object for correlation ID
	 * @returns The created country resource
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@UsePipes(new ZodValidationPipe(CreateCountryInputSchema))
	async create(
		@Body() createCountryDto: CreateCountryDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<CountryResponseDto> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] POST /v1/countries - Creating country: ${createCountryDto.alpha2}`,
		)

		try {
			// Call service to create country
			const country = await this.countriesService.create(createCountryDto)

			// Set Location header pointing to the created resource
			res.setHeader('Location', `/v1/countries/${country.alpha2}`)

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] POST /v1/countries - 201 Created (${duration}ms) - Country: ${country.alpha2}`,
			)

			return country
		} catch (error) {
			const duration = Date.now() - startTime

			// Log based on error type
			if (error instanceof HttpException) {
				const status = error.getStatus()
				this.logger.warn(
					`[${correlationId}] POST /v1/countries - ${status} ${error.message} (${duration}ms)`,
				)
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/countries - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				)
			}

			// Re-throw for NestJS exception filter to handle
			throw error
		}
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
