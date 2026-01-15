import {
	Controller,
	Post,
	Body,
	HttpCode,
	HttpStatus,
	HttpException,
	Req,
	Logger,
} from '@nestjs/common';
import { Request } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { SponsorChangedService } from './sponsor-changed.service.js';
import {
	SponsorChangedRequestDto,
	SponsorChangedRequestSchema,
} from './dto/sponsor-changed-request.dto.js';

/**
 * Controller for sponsor changed Kafka events.
 * Handles HTTP requests to trigger sponsor changed Kafka messages.
 */
@ApiTags('kafka')
@Controller('v1/kafka')
export class SponsorChangedController {
	private readonly logger = new Logger(SponsorChangedController.name);

	constructor(
		private readonly sponsorChangedService: SponsorChangedService,
	) {}

	/**
	 * Creates a sponsor changed Kafka message.
	 * POST /v1/kafka/sponsor-changed
	 *
	 * @param body - Request payload containing ApplicantUuid and SponsorUuid
	 * @param req - Express request object for correlation ID
	 * @returns Success response with 200 status
	 */
	@Post('sponsor-changed')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Send sponsor changed event to Kafka',
		description: 'Queries the sponsor agent with contact methods and addresses, builds the payload, and sends it to Global_SMS_SponsorChanged_V2 topic.',
	})
	@ApiBody({
		type: SponsorChangedRequestDto,
		description: 'Sponsor changed request payload',
	})
	@ApiResponse({
		status: 200,
		description: 'Sponsor changed message sent successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Sponsor agent not found',
	})
	async sponsorChanged(
		@Body(
			new ZodValidationPipe(
				SponsorChangedRequestSchema,
				'kafka.sponsor_changed.validation',
			),
		)
		body: SponsorChangedRequestDto,
		@Req() req: Request,
	): Promise<{ message: string }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);

		this.logger.log(
			`[${correlationId}] POST /v1/kafka/sponsor-changed - Processing sponsor changed event for applicant ${body.ApplicantUuid} and sponsor ${body.SponsorUuid}`,
		);

		try {
			await this.sponsorChangedService.processSponsorChanged(
				body.ApplicantUuid,
				body.SponsorUuid,
			);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/kafka/sponsor-changed - 200 OK (${duration}ms)`,
			);

			return {
				message: 'Sponsor changed message sent successfully',
			};
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/kafka/sponsor-changed - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/kafka/sponsor-changed - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : 'Unknown error',
				);
			}

			throw error;
		}
	}

	/**
	 * Extracts correlation ID from request headers.
	 *
	 * @param req - Express request object
	 * @returns Correlation ID or 'unknown'
	 */
	private getCorrelationId(req: Request): string {
		return (req.headers['x-correlation-id'] as string) || 'unknown';
	}
}

