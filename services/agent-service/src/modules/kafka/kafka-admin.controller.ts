import {
	Controller,
	Get,
	Post,
	Param,
	HttpCode,
	HttpStatus,
	Req,
	NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
} from '@nestjs/swagger';
import { KafkaServiceEntity, KafkaServiceType } from '@exprealty/database';
import { KafkaRuntimeManager, KafkaServiceRuntime, KafkaServiceStatus } from './kafka-runtime-manager.service.js';
import { KafkaBootstrapService } from './kafka-bootstrap.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { KafkaServiceResponseDto } from './dto/kafka-service-response.dto.js';
import { KafkaServiceOperationResponseDto } from './dto/kafka-service-operation-response.dto.js';
import { KafkaServiceIdParamDto } from './dto/kafka-service-id-param.dto.js';

/**
 * Kafka Admin Controller
 * 
 * Provides HTTP endpoints for managing Kafka services at runtime.
 * Admin-only endpoints - authentication/authorization should be added.
 * 
 * Endpoints:
 * - GET /v1/kafka/services - List all services with runtime state
 * - POST /v1/kafka/services/:id/start - Start a service
 * - POST /v1/kafka/services/:id/stop - Stop a service
 * - POST /v1/kafka/services/:id/enable - Enable a service (persists enabled=true, starts immediately)
 * - POST /v1/kafka/services/:id/disable - Disable a service (persists enabled=false, stops immediately)
 */
@ApiTags('kafka-admin')
@Controller('v1/kafka/services')
export class KafkaAdminController {
	private readonly logger: LoggerService;

	constructor(
		@InjectRepository(KafkaServiceEntity)
		private readonly kafkaServiceRepo: Repository<KafkaServiceEntity>,
		private readonly kafkaRuntimeManager: KafkaRuntimeManager,
		private readonly kafkaBootstrapService: KafkaBootstrapService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
	}

	/**
	 * Get all Kafka services with runtime state.
	 * Loads services from database and merges with runtime registry state.
	 * Returns all services with entity IDs for admin operations.
	 * No Kafka credentials exposed.
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List all Kafka services with runtime state',
		description: 'Returns all Kafka services from database with runtime state (if registered). No credentials or sensitive data exposed.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of services with runtime state',
		type: [KafkaServiceResponseDto],
	})
	async getServices(@Req() req: Request): Promise<KafkaServiceResponseDto[]> {
		this.logger.setContext('KafkaAdminController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] GET /v1/kafka/services - Listing all Kafka services`);

		// Load all services from database (not just enabled ones)
		const dbServices = await this.kafkaServiceRepo.find({
			order: { createdAt: 'ASC' },
		});

		// Get runtime state for registered services
		const runtimeMap = new Map<string, KafkaServiceRuntime>();
		for (const runtime of this.kafkaRuntimeManager.getAllRuntimes()) {
			const entityId = this.kafkaBootstrapService.getEntityIdByServiceId(runtime.id);
			if (entityId) {
				runtimeMap.set(entityId, runtime);
			}
		}

		// Merge database services with runtime state
		const servicesWithState: KafkaServiceResponseDto[] = dbServices.map((entity) => {
			const runtime = runtimeMap.get(entity.id);
			const serviceId = runtime?.id || this.kafkaBootstrapService.getServiceIdByEntityId(entity.id) || entity.id;

			return {
				id: serviceId,
				entityId: entity.id,
				serviceId,
				type: entity.type, // entity.type is already KafkaServiceType
				topic: entity.topic,
				groupId: entity.groupId || null,
				status: runtime?.status || KafkaServiceStatus.STOPPED,
				enabled: entity.enabled,
				startedAt: runtime?.startedAt || null,
				error: runtime?.error || null,
			};
		});
		
		// Sort services: global producer first, then others by topic (stable order)
		const sortedServices = servicesWithState.sort((a, b) => {
			// Global producer always first (type === PRODUCER && topic === 'global')
			const aIsGlobalProducer = a.type === KafkaServiceType.PRODUCER && a.topic === 'global';
			const bIsGlobalProducer = b.type === KafkaServiceType.PRODUCER && b.topic === 'global';
			
			if (aIsGlobalProducer && !bIsGlobalProducer) {
				return -1;
			}
			if (!aIsGlobalProducer && bIsGlobalProducer) {
				return 1;
			}
			
			// For all other services, sort by topic alphabetically for consistent ordering
			return a.topic.localeCompare(b.topic);
		});
		
		this.logger.info(`[${correlationId}] Retrieved ${sortedServices.length} service(s) from database`, {
			count: sortedServices.length,
			registered: runtimeMap.size,
		});

		return sortedServices;
	}

	/**
	 * Start a Kafka service by ID.
	 * Idempotent - safe to call multiple times.
	 */
	@Post(':id/start')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Start a Kafka service',
		description: 'Starts a registered Kafka service by ID. Idempotent operation - safe to call multiple times.',
	})
	@ApiParam({
		name: 'id',
		description: 'Service ID (UUID from database)',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Service started successfully',
		type: KafkaServiceOperationResponseDto,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Service not found',
	})
	async startService(
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<KafkaServiceOperationResponseDto> {
		this.logger.setContext('KafkaAdminController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/${id}/start - Starting service`);

		const serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(id);
		if (!serviceEntry) {
			throw new NotFoundException({
				message: `Kafka service with ID '${id}' not found`,
				i18nType: 'kafka.service.not_found',
			});
		}

		// Get the service ID (from service.getId()) to use with runtime manager
		const serviceId = serviceEntry.service.getId();

		try {
			await this.kafkaRuntimeManager.start(serviceId, serviceEntry.service);
			const runtime = this.kafkaRuntimeManager.getRuntime(serviceId);

			if (!runtime) {
				throw new Error(`Service ${serviceId} runtime not found after start`);
			}

			// Reload entity to get latest enabled state
			const updatedEntity = await this.kafkaServiceRepo.findOne({ where: { id } });
			if (!updatedEntity) {
				throw new NotFoundException({
					message: `Kafka service with ID '${id}' not found after start`,
					i18nType: 'kafka.service.not_found',
				});
			}

			this.logger.info(`[${correlationId}] Service ${id} (serviceId: ${serviceId}) started successfully`, {
				entityId: id,
				serviceId,
				type: runtime.type,
				topic: runtime.topic,
				status: runtime.status,
				enabled: updatedEntity.enabled,
			});

			return {
				message: 'Service started successfully',
				service: {
					id: runtime.id,
					entityId: id,
					serviceId: runtime.id,
					type: runtime.type as KafkaServiceType,
					topic: runtime.topic,
					groupId: runtime.groupId || null,
					status: runtime.status,
					enabled: updatedEntity.enabled,
					startedAt: runtime.startedAt || null,
					error: runtime.error || null,
				},
			};
		} catch (error) {
			this.logger.error(`[${correlationId}] Failed to start service ${id}`, {
				id,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		}
	}

	/**
	 * Stop a Kafka service by ID.
	 * Idempotent - safe to call multiple times.
	 */
	@Post(':id/stop')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Stop a Kafka service',
		description: 'Stops a registered Kafka service by ID. Idempotent operation - safe to call multiple times.',
	})
	@ApiParam({
		name: 'id',
		description: 'Service ID (UUID from database)',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Service stopped successfully',
		type: KafkaServiceOperationResponseDto,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Service not found',
	})
	async stopService(
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<KafkaServiceOperationResponseDto> {
		this.logger.setContext('KafkaAdminController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/${id}/stop - Stopping service`);

		const serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(id);
		if (!serviceEntry) {
			throw new NotFoundException({
				message: `Kafka service with ID '${id}' not found`,
				i18nType: 'kafka.service.not_found',
			});
		}

		// Get the service ID (from service.getId()) to use with runtime manager
		const serviceId = serviceEntry.service.getId();

		try {
			await this.kafkaRuntimeManager.stop(serviceId, serviceEntry.service);
			const runtime = this.kafkaRuntimeManager.getRuntime(serviceId);

			if (!runtime) {
				throw new Error(`Service ${serviceId} runtime not found after stop`);
			}

			// Reload entity to get latest enabled state
			const updatedEntity = await this.kafkaServiceRepo.findOne({ where: { id } });
			if (!updatedEntity) {
				throw new NotFoundException({
					message: `Kafka service with ID '${id}' not found after stop`,
					i18nType: 'kafka.service.not_found',
				});
			}

			this.logger.info(`[${correlationId}] Service ${id} (serviceId: ${serviceId}) stopped successfully`, {
				entityId: id,
				serviceId,
				type: runtime.type,
				topic: runtime.topic,
				status: runtime.status,
				enabled: updatedEntity.enabled,
			});

			return {
				message: 'Service stopped successfully',
				service: {
					id: runtime.id,
					entityId: id,
					serviceId: runtime.id,
					type: runtime.type as KafkaServiceType,
					topic: runtime.topic,
					groupId: runtime.groupId || null,
					status: runtime.status,
					enabled: updatedEntity.enabled,
					startedAt: runtime.startedAt || null,
					error: runtime.error || null,
				},
			};
		} catch (error) {
			this.logger.error(`[${correlationId}] Failed to stop service ${id}`, {
				id,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		}
	}

	/**
	 * Enable a Kafka service by ID.
	 * Persists enabled = true in database and starts the service immediately.
	 * Idempotent - safe to call multiple times.
	 */
	@Post(':id/enable')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Enable a Kafka service',
		description: 'Enables a Kafka service by ID. Persists enabled = true in database and starts the service immediately. Idempotent operation - safe to call multiple times.',
	})
	@ApiParam({
		name: 'id',
		description: 'Service ID (UUID from database)',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Service enabled and started successfully',
		type: KafkaServiceOperationResponseDto,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Service not found',
	})
	async enableService(
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<KafkaServiceOperationResponseDto> {
		this.logger.setContext('KafkaAdminController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/${id}/enable - Enabling service`);

		// Check if service exists in database
		const entity = await this.kafkaServiceRepo.findOne({ where: { id } });
		if (!entity) {
			throw new NotFoundException({
				message: `Kafka service with ID '${id}' not found`,
				i18nType: 'kafka.service.not_found',
			});
		}

		// Get service instance first (before updating database)
		// This allows us to validate the service exists before persisting enabled = true
		let serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(id);
		if (!serviceEntry) {
			// Service not in service map - register it now
			// This can happen if service was disabled before bootstrap
			this.logger.info(`[${correlationId}] Service ${id} not in service map - registering service instance`, {
				entityId: id,
			});
			serviceEntry = await this.kafkaBootstrapService.registerServiceEntity(entity);
			if (!serviceEntry) {
				throw new NotFoundException({
					message: `Kafka service with ID '${id}' could not be registered. Unknown service type or topic.`,
					i18nType: 'kafka.service.registration_failed',
				});
			}
		}

		const serviceId = serviceEntry.service.getId();

		// Update database: set enabled = true
		// Do this before starting so the service will start on next app restart even if current start fails
		if (!entity.enabled) {
			entity.enabled = true;
			await this.kafkaServiceRepo.save(entity);
			this.logger.info(`[${correlationId}] Service ${id} enabled in database`, {
				entityId: id,
				topic: entity.topic,
				type: entity.type,
			});
		}

		try {
			// Register service if not already registered
			if (!this.kafkaRuntimeManager.isRegistered(serviceId)) {
				this.kafkaRuntimeManager.register(serviceEntry.service);
			}

			// Start the service
			await this.kafkaRuntimeManager.start(serviceId, serviceEntry.service);
			const runtime = this.kafkaRuntimeManager.getRuntime(serviceId);

			if (!runtime) {
				throw new Error(`Service ${serviceId} runtime not found after start`);
			}

			// Reload entity to get latest enabled state
			const updatedEntity = await this.kafkaServiceRepo.findOne({ where: { id } });
			if (!updatedEntity) {
				throw new NotFoundException({
					message: `Kafka service with ID '${id}' not found after enable`,
					i18nType: 'kafka.service.not_found',
				});
			}

			this.logger.info(`[${correlationId}] Service ${id} (serviceId: ${serviceId}) enabled and started successfully`, {
				entityId: id,
				serviceId,
				type: runtime.type,
				topic: runtime.topic,
				status: runtime.status,
				enabled: updatedEntity.enabled,
			});

			return {
				message: 'Service enabled and started successfully',
				service: {
					id: runtime.id,
					entityId: id,
					serviceId: runtime.id,
					type: runtime.type as KafkaServiceType,
					topic: runtime.topic,
					groupId: runtime.groupId || null,
					status: runtime.status,
					enabled: updatedEntity.enabled,
					startedAt: runtime.startedAt || null,
					error: runtime.error || null,
				},
			};
		} catch (error) {
			// Service is enabled in DB (will start on next restart), but failed to start now
			// Get runtime to return current status (may be ERROR)
			const runtime = this.kafkaRuntimeManager.getRuntime(serviceId);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			
			this.logger.error(`[${correlationId}] Failed to start service ${id} after enabling`, {
				id,
				serviceId,
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				note: 'Service is enabled in database and will start automatically on next application restart',
			});

			// Return the service state even though start failed
			// This allows UI to show enabled=true but status=error
			if (runtime) {
				const updatedEntity = await this.kafkaServiceRepo.findOne({ where: { id } });
				return {
					message: `Service enabled in database but failed to start: ${errorMessage}. Service will start automatically on next application restart.`,
					service: {
						id: runtime.id,
						entityId: id,
						serviceId: runtime.id,
						type: runtime.type as KafkaServiceType,
						topic: runtime.topic,
						groupId: runtime.groupId || null,
						status: runtime.status, // Will be ERROR
						enabled: updatedEntity?.enabled ?? true,
						startedAt: runtime.startedAt || null,
						error: runtime.error || errorMessage,
					},
				};
			}

			// If no runtime exists, throw the error (service wasn't even registered)
			throw error;
		}
	}

	/**
	 * Disable a Kafka service by ID.
	 * Persists enabled = false in database and stops the service immediately.
	 * Idempotent - safe to call multiple times.
	 */
	@Post(':id/disable')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Disable a Kafka service',
		description: 'Disables a Kafka service by ID. Persists enabled = false in database and stops the service immediately. Disabled services will NOT start automatically on next deployment. Idempotent operation - safe to call multiple times.',
	})
	@ApiParam({
		name: 'id',
		description: 'Service ID (UUID from database)',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Service disabled and stopped successfully',
		type: KafkaServiceOperationResponseDto,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Service not found',
	})
	async disableService(
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<KafkaServiceOperationResponseDto> {
		this.logger.setContext('KafkaAdminController');
		const correlationId = this.getCorrelationId(req);
		this.logger.info(`[${correlationId}] POST /v1/kafka/services/${id}/disable - Disabling service`);

		// Check if service exists in database
		const entity = await this.kafkaServiceRepo.findOne({ where: { id } });
		if (!entity) {
			throw new NotFoundException({
				message: `Kafka service with ID '${id}' not found`,
				i18nType: 'kafka.service.not_found',
			});
		}

		// Update database: set enabled = false
		if (entity.enabled) {
			entity.enabled = false;
			await this.kafkaServiceRepo.save(entity);
			this.logger.info(`[${correlationId}] Service ${id} disabled in database`, {
				entityId: id,
				topic: entity.topic,
				type: entity.type,
			});
		}

		// Stop the service if it's running
		const serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(id);
		let serviceId: string | undefined;
		if (serviceEntry) {
			serviceId = serviceEntry.service.getId();
			
			// Only try to stop if service is registered and running
			if (this.kafkaRuntimeManager.isRegistered(serviceId)) {
				try {
					await this.kafkaRuntimeManager.stop(serviceId, serviceEntry.service);
					this.logger.info(`[${correlationId}] Service ${id} stopped after disable`, {
						entityId: id,
						serviceId,
					});
				} catch (error) {
					// Log error but don't fail the disable operation
					// The database update is the source of truth
					this.logger.warn(`[${correlationId}] Failed to stop service ${id} during disable, but service is disabled in database`, {
						entityId: id,
						serviceId,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			}
		}

		// Get runtime state (may be stopped or not registered)
		const runtime = serviceId ? this.kafkaRuntimeManager.getRuntime(serviceId) : undefined;

		// Reload entity to get latest enabled state
		const updatedEntity = await this.kafkaServiceRepo.findOne({ where: { id } });
		if (!updatedEntity) {
			throw new NotFoundException({
				message: `Kafka service with ID '${id}' not found after disable`,
				i18nType: 'kafka.service.not_found',
			});
		}

		// Build response with runtime state or default
		const responseRuntime: KafkaServiceRuntime = runtime || {
			id: serviceId || id,
			type: entity.type,
			topic: entity.topic,
			groupId: entity.groupId || undefined,
			status: KafkaServiceStatus.STOPPED,
		};

		this.logger.info(`[${correlationId}] Service ${id} disabled successfully`, {
			entityId: id,
			enabled: updatedEntity.enabled,
			status: responseRuntime.status,
		});

		return {
			message: 'Service disabled successfully',
			service: {
				id: responseRuntime.id,
				entityId: id,
				serviceId: responseRuntime.id,
				type: responseRuntime.type as KafkaServiceType,
				topic: responseRuntime.topic,
				groupId: responseRuntime.groupId || null,
				status: responseRuntime.status,
				enabled: updatedEntity.enabled,
				startedAt: responseRuntime.startedAt || null,
				error: responseRuntime.error || null,
			},
		};
	}

	/**
	 * Extract correlation ID from request headers.
	 */
	private getCorrelationId(req: Request): string {
		return (req.headers['x-correlation-id'] as string) || 'unknown';
	}
}

