import {
	Controller,
	Post,
	HttpCode,
	HttpStatus,
	Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
} from '@nestjs/swagger';
import { KafkaBulkOperationsService, BulkOperationResponse } from './services/kafka-bulk-operations.service.js';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Kafka Bulk Operations Controller
 * 
 * Provides HTTP endpoints for bulk operations on Kafka services.
 * Admin-only endpoints - authentication/authorization should be added.
 * 
 * Endpoints:
 * - POST /v1/kafka/services/bulk/start-enabled - Start all enabled services
 * - POST /v1/kafka/services/bulk/stop-running - Stop all running services
 * - POST /v1/kafka/services/bulk/enable-all - Enable all services
 * - POST /v1/kafka/services/bulk/disable-all - Disable all services
 */
@ApiTags('kafka-admin')
@Controller('v1/kafka/services/bulk')
export class KafkaBulkOperationsController {
	private readonly logger: LoggerService;

	constructor(
		private readonly bulkOperationsService: KafkaBulkOperationsService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
	}

	/**
	 * Start all services that are enabled = true.
	 */
	@Post('start-enabled')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Start all enabled Kafka services',
		description: 'Starts all Kafka services that have enabled = true in the database.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Bulk start operation completed',
		type: Object,
	})
	async startAllEnabled(@Req() req: Request): Promise<BulkOperationResponse> {
		this.logger.setContext('KafkaBulkOperationsController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/bulk/start-enabled - Starting all enabled services`);
		
		return await this.bulkOperationsService.startAllEnabled();
	}

	/**
	 * Stop all currently running services.
	 */
	@Post('stop-running')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Stop all running Kafka services',
		description: 'Stops all Kafka services that are currently running.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Bulk stop operation completed',
		type: Object,
	})
	async stopAllRunning(@Req() req: Request): Promise<BulkOperationResponse> {
		this.logger.setContext('KafkaBulkOperationsController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/bulk/stop-running - Stopping all running services`);
		
		return await this.bulkOperationsService.stopAllRunning();
	}

	/**
	 * Enable all services.
	 */
	@Post('enable-all')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Enable all Kafka services',
		description: 'Enables all Kafka services (sets enabled = true) and starts them.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Bulk enable operation completed',
		type: Object,
	})
	async enableAll(@Req() req: Request): Promise<BulkOperationResponse> {
		this.logger.setContext('KafkaBulkOperationsController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/bulk/enable-all - Enabling all services`);
		
		return await this.bulkOperationsService.enableAll();
	}

	/**
	 * Disable all services (and stop any that are running).
	 */
	@Post('disable-all')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Disable all Kafka services',
		description: 'Disables all Kafka services (sets enabled = false) and stops any that are running.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Bulk disable operation completed',
		type: Object,
	})
	async disableAll(@Req() req: Request): Promise<BulkOperationResponse> {
		this.logger.setContext('KafkaBulkOperationsController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/bulk/disable-all - Disabling all services`);
		
		return await this.bulkOperationsService.disableAll();
	}

	/**
	 * Extract correlation ID from request headers.
	 */
	private getCorrelationId(req: Request): string {
		return (req.headers['x-correlation-id'] as string) || 'unknown';
	}
}

