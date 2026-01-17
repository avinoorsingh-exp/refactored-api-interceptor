import {
	Controller,
	Get,
	Query,
	HttpCode,
	HttpStatus,
	Req,
	UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiQuery,
} from '@nestjs/swagger';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { KafkaMessageProcessingResponseDto } from './dto/kafka-message-processing-response.dto.js';

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
		description: 'Retrieves a paginated list of Kafka message processing records. Default sort: createdAt DESC (newest first). Supports filtering, sorting, and search.',
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
}

