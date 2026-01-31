import {
	Controller,
	Get,
	Post,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	Req,
	Res,
	UseInterceptors,
	ParseUUIDPipe,
	BadRequestException,
	NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiQuery,
	ApiParam,
	ApiBody,
	ApiExtraModels,
	ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { KafkaMessageProcessingResponseDto } from './dto/kafka-message-processing-response.dto.js';
import { ProduceMessageRequestDto } from './dto/produce-message-request.dto.js';
import { BatchRetryRequestDto } from './dto/batch-retry-request.dto.js';
// RetryMessageRequestDto removed - not used for validation, only Swagger docs if needed

/**
 * Controller for Kafka message processing endpoints.
 * Handles HTTP requests related to Kafka message processing records.
 */
@ApiTags('kafka')
@Controller('v1/kafka/messages')
export class KafkaMessageProcessingController {
	constructor(
		private readonly kafkaMessageProcessingService: KafkaMessageProcessingService,
	) {}

	/**
	 * Retrieves a paginated list of Kafka message processing records.
	 * GET /v1/kafka/messages?offset={n}&limit={m}
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param req - Express request object for correlation ID
	 * @returns Paginated list of Kafka message processing records with metadata
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List Kafka message processing records with pagination, filtering, sorting, and search',
		description: 'Retrieves a paginated list of Kafka message processing records. Default sort: lastAttemptAt DESC (most recently attempted first), then createdAt DESC. Supports filtering, sorting, and search.',
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
		description: 'Kafka message processing records retrieved successfully',
		type: [KafkaMessageProcessingResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of Kafka message processing records',
				schema: { type: 'string' },
			},
			'Link': {
				description: 'RFC 8288 pagination links',
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
	): Promise<{ items: KafkaMessageProcessingResponseDto[]; total: number }> {
		const result = await this.kafkaMessageProcessingService.findPage(query);

		return {
			items: result.items,
			total: result.total,
		};
	}

	/**
	 * Retry multiple failed messages in batch.
	 * POST /v1/kafka/messages/retry-batch
	 *
	 * @param body - Request body containing array of message IDs
	 * @param req - Express request object for correlation ID
	 * @returns Summary of retry results
	 */
	@Post('retry-batch')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Retry multiple failed messages in batch',
		description: 'Retries processing multiple messages that failed with status ERROR. Each message is retried independently.',
	})
	@ApiResponse({
		status: 200,
		description: 'Batch retry completed',
		schema: {
			type: 'object',
			properties: {
				successful: { type: 'number', example: 2 },
				failed: { type: 'number', example: 1 },
				results: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							messageId: { type: 'string' },
							success: { type: 'boolean' },
							error: { type: 'string' },
						},
						required: ['messageId', 'success'],
					},
				},
			},
		},
	})
	async batchRetryMessages(
		@Body() body: BatchRetryRequestDto,
		@Req() req: Request,
	): Promise<{
		successful: number;
		failed: number;
		results: Array<{
			messageId: string;
			success: boolean;
			error?: string;
		}>;
	}> {
		return await this.kafkaMessageProcessingService.batchRetryMessages(body.messageIds);
	}

	/**
	 * Manually produce a message to any Kafka topic.
	 * POST /v1/kafka/messages/produce
	 *
	 * @param body - Request body containing topic, payload, and optional key/headers
	 * @param req - Express request object for correlation ID
	 * @returns Created message record
	 */
	@Post('produce')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Produce a message to any Kafka topic',
		description: 'Manually sends a message to a Kafka topic and creates a tracking record. The message will be logged and tracked just like messages sent via the producer service.',
	})
	@ApiBody({
		description: 'Request body for producing a Kafka message. Payload field accepts any JSON structure depending on the topic.',
		type: ProduceMessageRequestDto,
		schema: {
			type: 'object',
			required: ['topic'],
			properties: {
				topic: {
					type: 'string',
					description: 'Kafka topic name',
					example: 'Global_SMS_SponsorChanged_V2',
				},
				payload: {
					description: 'Message payload - accepts any JSON value (object, array, string, number, boolean, null). Structure varies by topic.',
					// Use oneOf to accept any JSON type
					oneOf: [
						{ type: 'object', additionalProperties: true },
						{ type: 'array', items: {} },
						{ type: 'string' },
						{ type: 'number' },
						{ type: 'boolean' },
						{ type: 'null' },
					],
					example: { applicantUuid: '123', sponsorUuid: '456' },
				},
				key: {
					type: 'string',
					description: 'Optional message key for partitioning',
					example: 'agent-123',
				},
				headers: {
					type: 'object',
					description: 'Optional message headers',
					additionalProperties: { type: 'string' },
					example: { 'correlation-id': 'abc-123' },
				},
			},
			// Allow additional properties at root level for backward compatibility
			additionalProperties: true,
		},
	})
	@ApiResponse({
		status: 201,
		description: 'Message produced successfully',
		type: KafkaMessageProcessingResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid request body',
	})
	async produceMessage(
		@Body() body: ProduceMessageRequestDto,
		@Req() req: Request,
	): Promise<KafkaMessageProcessingResponseDto> {
		// Accept any payload type (object, array, string, number, boolean, null)
		// The service method handles all JSON types
		return await this.kafkaMessageProcessingService.produceMessage(
			body.topic,
			body.payload ?? null, // Default to null if undefined
			body.key,
			body.headers,
		);
	}

	/**
	 * Retrieves a single Kafka message processing record by ID.
	 * GET /v1/kafka/messages/:id
	 *
	 * @param id - Message record ID (UUID)
	 * @param req - Express request object for correlation ID
	 * @returns Kafka message processing record
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get a Kafka message processing record by ID',
		description: 'Retrieves a single Kafka message processing record by its UUID.',
	})
	@ApiParam({
		name: 'id',
		description: 'Message record ID (UUID)',
		type: String,
		example: 'c60706a1-bfc0-4dcb-8192-7cd9ae2434f2',
	})
	@ApiResponse({
		status: 200,
		description: 'Kafka message processing record retrieved successfully',
		type: KafkaMessageProcessingResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Message not found',
	})
	async findOne(
		@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
		@Req() req: Request,
	): Promise<KafkaMessageProcessingResponseDto> {
		const message = await this.kafkaMessageProcessingService.findById(id);
		
		if (!message) {
			throw new NotFoundException({
				message: `Kafka message with ID '${id}' not found`,
				i18nType: 'kafka.message.not_found',
			});
		}
		
		return this.kafkaMessageProcessingService.mapEntityToDto(message);
	}

	/**
	 * Retry processing a failed message.
	 * POST /v1/kafka/messages/:id/retry
	 *
	 * @param id - Message record ID (UUID)
	 * @param req - Express request object for correlation ID
	 * @returns Updated message record
	 */
	@Post(':id/retry')
	@HttpCode(HttpStatus.OK)
	@ApiExcludeEndpoint() // Exclude from Swagger to prevent schema validation
	async retryMessage(
		@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
		@Req() req: Request,
		@Res({ passthrough: false }) res: Response,
	): Promise<void> {
		// Bypass NestJS body parsing entirely by using @Res() and handling response manually
		// This prevents any automatic validation from occurring
		try {
		// Get body directly from request to bypass any NestJS transformation/validation
		const body = req.body as Record<string, any> | undefined;
		
		// Handle two cases:
		// 1. Body is a RetryMessageRequestDto with a payload property: { payload: {...} }
		// 2. Body is the payload directly: {...}
		// 3. Body is undefined/empty (use stored payload)
		// Empty object {} should be treated as "no custom payload"
		let customPayload: Record<string, unknown> | undefined;
		
		if (body && typeof body === 'object' && !Array.isArray(body)) {
			const bodyKeys = Object.keys(body);
			
			// Check if body has a 'payload' property (RetryMessageRequestDto format)
			if ('payload' in body && typeof body.payload === 'object' && body.payload !== null) {
				// Only use payload if it's not empty
				const payloadKeys = Object.keys(body.payload);
				if (payloadKeys.length > 0) {
					customPayload = body.payload as Record<string, unknown>;
				}
			} else if (bodyKeys.length > 0) {
				// Body is the payload directly (and it's not empty)
				customPayload = body as Record<string, unknown>;
			}
			// If body is empty object {}, customPayload remains undefined
		}
		
		// Optional body allows frontend to provide amended message payload
		// If provided, it will be used instead of stored payload and translation will be skipped
		// Validation will happen in the service layer (Zod validation in EnterpriseAgentUpsertService)
		const result = await this.kafkaMessageProcessingService.retryMessage(id, customPayload);
		res.status(HttpStatus.OK).json(result);
		} catch (error) {
			// Let ProblemDetailsFilter handle the error
			throw error;
		}
	}
}

