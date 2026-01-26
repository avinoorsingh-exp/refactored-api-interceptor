import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaServiceEntity } from '@exprealty/database';
import { KafkaRuntimeManager, KafkaServiceStatus } from '../kafka-runtime-manager.service.js';
import { KafkaBootstrapService } from '../kafka-bootstrap.service.js';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Result of a bulk operation on a single service.
 */
export interface BulkOperationResult {
	entityId: string;
	serviceId: string;
	topic: string;
	success: boolean;
	error?: string;
}

/**
 * Result of a bulk operation.
 */
export interface BulkOperationResponse {
	total: number;
	successful: number;
	failed: number;
	results: BulkOperationResult[];
}

/**
 * Service for performing bulk operations on Kafka services.
 */
@Injectable()
export class KafkaBulkOperationsService {
	private readonly logger: LoggerService;

	constructor(
		@InjectRepository(KafkaServiceEntity)
		private readonly kafkaServiceRepo: Repository<KafkaServiceEntity>,
		private readonly kafkaRuntimeManager: KafkaRuntimeManager,
		private readonly kafkaBootstrapService: KafkaBootstrapService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaBulkOperationsService');
	}

	/**
	 * Start all services that are enabled = true.
	 */
	async startAllEnabled(): Promise<BulkOperationResponse> {
		this.logger.info('Starting bulk start operation for all enabled services');

		const enabledServices = await this.kafkaServiceRepo.find({
			where: { enabled: true },
		});

		const results: BulkOperationResult[] = [];

		for (const entity of enabledServices) {
			try {
				let serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(entity.id);
				if (!serviceEntry) {
					serviceEntry = this.kafkaBootstrapService.registerServiceEntity(entity);
					if (!serviceEntry) {
						results.push({
							entityId: entity.id,
							serviceId: entity.id,
							topic: entity.topic,
							success: false,
							error: 'Service could not be registered',
						});
						continue;
					}
				}

				const serviceId = serviceEntry.service.getId();

				if (!this.kafkaRuntimeManager.isRegistered(serviceId)) {
					this.kafkaRuntimeManager.register(serviceEntry.service);
				}

				const runtime = this.kafkaRuntimeManager.getRuntime(serviceId);
				if (runtime && (runtime.status === KafkaServiceStatus.RUNNING || runtime.status === KafkaServiceStatus.ATTACHED)) {
					results.push({
						entityId: entity.id,
						serviceId,
						topic: entity.topic,
						success: true,
					});
					continue;
				}

				await this.kafkaRuntimeManager.start(serviceId, serviceEntry.service);

				results.push({
					entityId: entity.id,
					serviceId,
					topic: entity.topic,
					success: true,
				});
			} catch (error) {
				this.logger.error(`Failed to start service ${entity.id}`, {
					entityId: entity.id,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				results.push({
					entityId: entity.id,
					serviceId: entity.id,
					topic: entity.topic,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		this.logger.info('Bulk start operation completed', {
			total: results.length,
			successful,
			failed,
		});

		return {
			total: results.length,
			successful,
			failed,
			results,
		};
	}

	/**
	 * Stop all currently running services.
	 */
	async stopAllRunning(): Promise<BulkOperationResponse> {
		this.logger.info('Starting bulk stop operation for all running services');

		const allRuntimes = this.kafkaRuntimeManager.getAllRuntimes();
		const runningRuntimes = allRuntimes.filter(
			(runtime) => runtime.status === KafkaServiceStatus.RUNNING || runtime.status === KafkaServiceStatus.ATTACHED,
		);

		const results: BulkOperationResult[] = [];

		for (const runtime of runningRuntimes) {
			try {
				const entityId = this.kafkaBootstrapService.getEntityIdByServiceId(runtime.id);
				if (!entityId) {
					results.push({
						entityId: runtime.id,
						serviceId: runtime.id,
						topic: runtime.topic,
						success: false,
						error: 'Entity ID not found',
					});
					continue;
				}

				const serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(entityId);
				if (!serviceEntry) {
					results.push({
						entityId,
						serviceId: runtime.id,
						topic: runtime.topic,
						success: false,
						error: 'Service entry not found',
					});
					continue;
				}

				await this.kafkaRuntimeManager.stop(runtime.id, serviceEntry.service);

				results.push({
					entityId,
					serviceId: runtime.id,
					topic: runtime.topic,
					success: true,
				});
			} catch (error) {
				this.logger.error(`Failed to stop service ${runtime.id}`, {
					serviceId: runtime.id,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				const entityId = this.kafkaBootstrapService.getEntityIdByServiceId(runtime.id) || runtime.id;
				results.push({
					entityId,
					serviceId: runtime.id,
					topic: runtime.topic,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		this.logger.info('Bulk stop operation completed', {
			total: results.length,
			successful,
			failed,
		});

		return {
			total: results.length,
			successful,
			failed,
			results,
		};
	}

	/**
	 * Enable all services.
	 */
	async enableAll(): Promise<BulkOperationResponse> {
		this.logger.info('Starting bulk enable operation for all services');

		const allServices = await this.kafkaServiceRepo.find();

		const results: BulkOperationResult[] = [];

		for (const entity of allServices) {
			try {
				if (!entity.enabled) {
					entity.enabled = true;
					await this.kafkaServiceRepo.save(entity);
				}

				let serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(entity.id);
				if (!serviceEntry) {
					serviceEntry = this.kafkaBootstrapService.registerServiceEntity(entity);
					if (!serviceEntry) {
						results.push({
							entityId: entity.id,
							serviceId: entity.id,
							topic: entity.topic,
							success: false,
							error: 'Service could not be registered',
						});
						continue;
					}
				}

				const serviceId = serviceEntry.service.getId();

				if (!this.kafkaRuntimeManager.isRegistered(serviceId)) {
					this.kafkaRuntimeManager.register(serviceEntry.service);
				}

				const runtime = this.kafkaRuntimeManager.getRuntime(serviceId);
				if (runtime && (runtime.status === KafkaServiceStatus.RUNNING || runtime.status === KafkaServiceStatus.ATTACHED)) {
					results.push({
						entityId: entity.id,
						serviceId,
						topic: entity.topic,
						success: true,
					});
					continue;
				}

				await this.kafkaRuntimeManager.start(serviceId, serviceEntry.service);

				results.push({
					entityId: entity.id,
					serviceId,
					topic: entity.topic,
					success: true,
				});
			} catch (error) {
				this.logger.error(`Failed to enable service ${entity.id}`, {
					entityId: entity.id,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				results.push({
					entityId: entity.id,
					serviceId: entity.id,
					topic: entity.topic,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		this.logger.info('Bulk enable operation completed', {
			total: results.length,
			successful,
			failed,
		});

		return {
			total: results.length,
			successful,
			failed,
			results,
		};
	}

	/**
	 * Disable all services (and stop any that are running).
	 */
	async disableAll(): Promise<BulkOperationResponse> {
		this.logger.info('Starting bulk disable operation for all services');

		const allServices = await this.kafkaServiceRepo.find();

		const results: BulkOperationResult[] = [];

		for (const entity of allServices) {
			try {
				if (entity.enabled) {
					entity.enabled = false;
					await this.kafkaServiceRepo.save(entity);
				}

				const serviceEntry = this.kafkaBootstrapService.getServiceByEntityId(entity.id);
				if (serviceEntry) {
					const serviceId = serviceEntry.service.getId();
					if (this.kafkaRuntimeManager.isRegistered(serviceId)) {
						try {
							await this.kafkaRuntimeManager.stop(serviceId, serviceEntry.service);
						} catch (error) {
							this.logger.warn(`Failed to stop service ${entity.id} during disable`, {
								entityId: entity.id,
								error: error instanceof Error ? error.message : 'Unknown error',
							});
						}
					}
				}

				results.push({
					entityId: entity.id,
					serviceId: entity.id,
					topic: entity.topic,
					success: true,
				});
			} catch (error) {
				this.logger.error(`Failed to disable service ${entity.id}`, {
					entityId: entity.id,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				results.push({
					entityId: entity.id,
					serviceId: entity.id,
					topic: entity.topic,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		this.logger.info('Bulk disable operation completed', {
			total: results.length,
			successful,
			failed,
		});

		return {
			total: results.length,
			successful,
			failed,
			results,
		};
	}
}

