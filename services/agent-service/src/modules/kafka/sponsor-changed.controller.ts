import {
	Controller,
	Post,
	HttpCode,
	HttpStatus,
	HttpException,
	Req,
	Logger,
	Param,
	Body,
	Query,
} from '@nestjs/common';
import { Request } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiBody,
	ApiQuery,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { SponsorChangedService } from './sponsor-changed.service.js';
import {
	SponsorAssignedParamsDto,
	SponsorAssignedParamsSchema,
} from './dto/sponsor-assigned-params.dto.js';
import {
	SponsorWriteInRequestDto,
	SponsorWriteInRequestSchema,
} from './dto/sponsor-write-in-request.dto.js';
import { parseSponsorSubjectType, type SponsorSubjectType } from './dto/sponsor-subject-type.dto.js';

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
	 * Creates a sponsor write-in Kafka message.
	 * POST /v1/kafka/sponsor-assigned/:applicantUuid/write-in
	 *
	 * Declared before the :applicantUuid/:sponsorUuid route so the literal path "write-in" matches
	 * instead of being captured as sponsorUuid.
	 *
	 * @param applicantUuid - UUID of the applicant agent (path parameter)
	 * @param body - Request body containing sponsor name (write-in text value)
	 * @param req - Express request object for correlation ID
	 * @returns Success response with 200 status
	 */
	@Post('sponsor-assigned/:applicantUuid/write-in')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Send sponsor write-in event to Kafka',
		description: 'Builds a payload with applicant UUID and sponsor write-in name, and sends it to Global_SMS_SponsorChanged_V2 topic.',
	})
	@ApiParam({
		name: 'applicantUuid',
		description: 'UUID of the applicant agent',
		type: String,
		format: 'uuid',
	})
	@ApiBody({
		description: 'Sponsor write-in request body',
		type: SponsorWriteInRequestDto,
	})
	@ApiResponse({
		status: 200,
		description: 'Sponsor write-in message sent successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiQuery({
		name: 'type',
		required: false,
		description: 'Subject type: "applicant" (payload uses ApplicantUuid) or "agent" (payload uses AgentUuid). Defaults to "applicant".',
		enum: ['applicant', 'agent'],
	})
	async sponsorWriteIn(
		@Param('applicantUuid') applicantUuid: string,
		@Query('type') typeParam: string | undefined,
		@Body(
			new ZodValidationPipe(
				SponsorWriteInRequestSchema,
				'kafka.sponsor_write_in.validation',
			),
		)
		body: SponsorWriteInRequestDto,
		@Req() req: Request,
	): Promise<{ message: string }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);
		const type: SponsorSubjectType = parseSponsorSubjectType(typeParam);

		this.logger.log(
			`[${correlationId}] POST /v1/kafka/sponsor-assigned/${applicantUuid}/write-in - Processing sponsor write-in event for ${type} ${applicantUuid} with sponsor name "${body.name}"`,
		);

		try {
			// Validate applicant UUID format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(applicantUuid)) {
				throw new HttpException(
					{
						message: `Invalid ApplicantUuid format: ${applicantUuid}`,
						i18nType: 'kafka.sponsor_write_in.invalid_uuid',
					},
					HttpStatus.BAD_REQUEST,
				);
			}

			await this.sponsorChangedService.processSponsorWriteIn(applicantUuid, body.name, type);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/kafka/sponsor-assigned/${applicantUuid}/write-in - 200 OK (${duration}ms)`,
			);

			return {
				message: 'Sponsor write-in message sent successfully',
			};
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/kafka/sponsor-assigned/${applicantUuid}/write-in - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/kafka/sponsor-assigned/${applicantUuid}/write-in - 500 Internal Server Error (${duration}ms)`,
					error instanceof Error ? error.stack : 'Unknown error',
				);
			}

			throw error;
		}
	}

	/**
	 * Creates a sponsor changed Kafka message.
	 * POST /v1/kafka/sponsor-assigned/:applicantUuid/:sponsorUuid
	 *
	 * @param params - Path parameters containing ApplicantUuid and SponsorUuid
	 * @param req - Express request object for correlation ID
	 * @returns Success response with 200 status
	 */
	@Post('sponsor-assigned/:applicantUuid/:sponsorUuid')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Send sponsor changed event to Kafka',
		description: 'Queries the sponsor agent with contact methods and addresses, builds the payload, and sends it to Global_SMS_SponsorChanged_V2 topic.',
	})
	@ApiParam({
		name: 'applicantUuid',
		description: 'UUID of the applicant agent',
		type: String,
		format: 'uuid',
	})
	@ApiParam({
		name: 'sponsorUuid',
		description: 'UUID of the sponsor agent',
		type: String,
		format: 'uuid',
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
	@ApiQuery({
		name: 'type',
		required: false,
		description: 'Subject type: "applicant" (payload uses ApplicantUuid) or "agent" (payload uses AgentUuid). Defaults to "applicant".',
		enum: ['applicant', 'agent'],
	})
	async sponsorChanged(
		@Param(
			new ZodValidationPipe(
				SponsorAssignedParamsSchema,
				'kafka.sponsor_assigned.validation',
			),
		)
		params: SponsorAssignedParamsDto,
		@Query('type') typeParam: string | undefined,
		@Req() req: Request,
	): Promise<{ message: string }> {
		const startTime = Date.now();
		const correlationId = this.getCorrelationId(req);
		const type: SponsorSubjectType = parseSponsorSubjectType(typeParam);

		this.logger.log(
			`[${correlationId}] POST /v1/kafka/sponsor-assigned/${params.applicantUuid}/${params.sponsorUuid} - Processing sponsor changed event for ${type} ${params.applicantUuid} and sponsor ${params.sponsorUuid}`,
		);

		try {
			await this.sponsorChangedService.processSponsorChanged(
				params.applicantUuid,
				params.sponsorUuid,
				type,
			);

			const duration = Date.now() - startTime;
			this.logger.log(
				`[${correlationId}] POST /v1/kafka/sponsor-assigned/${params.applicantUuid}/${params.sponsorUuid} - 200 OK (${duration}ms)`,
			);

			return {
				message: 'Sponsor changed message sent successfully',
			};
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof HttpException) {
				const status = error.getStatus();
				this.logger.warn(
					`[${correlationId}] POST /v1/kafka/sponsor-assigned/${params.applicantUuid}/${params.sponsorUuid} - ${status} ${error.message} (${duration}ms)`,
				);
			} else {
				this.logger.error(
					`[${correlationId}] POST /v1/kafka/sponsor-assigned/${params.applicantUuid}/${params.sponsorUuid} - 500 Internal Server Error (${duration}ms)`,
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

