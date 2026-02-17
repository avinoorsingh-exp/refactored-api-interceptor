import {
	Controller,
	Post,
	Body,
	HttpCode,
	HttpStatus,
	Res,
	Req,
	HttpException,
	Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
} from '@nestjs/swagger'
import { CreateLineOfBusinessInputSchema } from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { LineOfBusinessService } from './line-of-business.service.js'
import { CreateLineOfBusinessDto, LineOfBusinessResponseDto } from './dto/index.js'

/**
 * Controller for LineOfBusiness resource endpoints.
 * Handles HTTP requests for line of business operations.
 */
@ApiTags('line-of-businesses')
@Controller('v1/line-of-businesses')
export class LineOfBusinessController {
	private readonly logger = new Logger(LineOfBusinessController.name)

	constructor(private readonly lineOfBusinessService: LineOfBusinessService) {}

	/**
	 * Creates a new line of business.
	 * POST /v1/line-of-businesses
	 *
	 * @param body - Line of business data to create
	 * @param res - Express response object for setting Location header
	 * @param req - Express request object for correlation ID
	 * @returns The created line of business with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new line of business',
		description: 'Creates a new line of business with a unique name.',
	})
	@ApiBody({
		type: CreateLineOfBusinessDto,
		description: 'Line of business data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Line of business created successfully',
		type: LineOfBusinessResponseDto,
		headers: {
			Location: {
				description: 'URL of the created line of business',
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
				CreateLineOfBusinessInputSchema,
				'lineOfBusiness.validation',
			),
		)
		body: CreateLineOfBusinessDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<LineOfBusinessResponseDto> {
		const startTime = Date.now()
		const correlationId = this.getCorrelationId(req)

		this.logger.log(
			`[${correlationId}] POST /v1/line-of-businesses - Creating line of business: ${body.name}`,
		)

		try {
			const lineOfBusiness = await this.lineOfBusinessService.create(body)

			// Set Location header
			res.setHeader('Location', `/v1/line-of-businesses/${lineOfBusiness.id}`)

			const duration = Date.now() - startTime
			this.logger.log(
				`[${correlationId}] POST /v1/line-of-businesses - 201 Created (${duration}ms) - LineOfBusiness: ${lineOfBusiness.name}`,
			)

			return lineOfBusiness
		} catch (error) {
			const duration = Date.now() - startTime

			if (error instanceof HttpException) {
				const status = error.getStatus()
				this.logger.warn(
					`[${correlationId}] POST /v1/line-of-businesses - ${status} ${error.message} (${duration}ms)`,
				)
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/line-of-businesses - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : undefined,
				)
			}

			throw error
		}
	}

	/**
	 * Extracts correlation ID from request headers.
	 */
	private getCorrelationId(req: Request): string {
		return (req.headers['x-correlation-id'] as string) || 'no-correlation-id'
	}
}
