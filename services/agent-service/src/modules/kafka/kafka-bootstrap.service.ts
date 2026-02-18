import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaServiceEntity, KafkaServiceType } from '@exprealty/database';
import { KafkaRuntimeManager } from './kafka-runtime-manager.service.js';
import type { KafkaProducerService } from './kafka-producer.service.js';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';
import type { EnterpriseAgentUpdatedConsumer } from './consumers/enterprise-agent-updated.consumer.js';
import type { AuAgentDetailsAgentUpdatedConsumer } from './consumers/au-agent-details-agent-updated.consumer.js';
import type { UkAgentDetailsAgentUpdatedConsumer } from './consumers/uk-agent-details-agent-updated.consumer.js';
import type { GlobalAdsAgentCreatedConsumer } from './consumers/global-ads-agent-created.consumer.js';
import type { GlobalAdsAgentUpdatedConsumer } from './consumers/global-ads-agent-updated.consumer.js';

/**
 * Kafka Bootstrap Service
 * 
 * Loads Kafka service definitions from the database and starts enabled services.
 * Runs on application bootstrap to decouple Kafka lifecycle from ORM initialization.
 */
@Injectable()
export class KafkaBootstrapService implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger: LoggerService;
	private readonly serviceMap = new Map<string, { service: any; entity: KafkaServiceEntity }>();
	private readonly consumerCache = new Map<string, any>();
	private _kafkaProducerService: KafkaProducerService | null = null;

	constructor(
		@InjectRepository(KafkaServiceEntity)
		private readonly kafkaServiceRepo: Repository<KafkaServiceEntity>,
		private readonly kafkaRuntimeManager: KafkaRuntimeManager,
		private readonly configService: ConfigService,
		private readonly moduleRef: ModuleRef,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaBootstrapService');
	}

	/**
	 * Get KafkaProducerService instance asynchronously via ModuleRef.
	 * This breaks the circular dependency by loading the class at runtime.
	 * Uses cached instance after first resolution.
	 */
	private async getKafkaProducerServiceAsync(): Promise<KafkaProducerService> {
		if (this._kafkaProducerService) {
			return this._kafkaProducerService;
		}

		// Dynamic import to avoid circular dependency at module load time
		const { KafkaProducerService } = await import('./kafka-producer.service.js');
		this._kafkaProducerService = this.moduleRef.get(KafkaProducerService, { strict: false });
		return this._kafkaProducerService;
	}

	async onApplicationBootstrap(): Promise<void> {
		const nodeEnv = this.configService.get('NODE_ENV');
		
		// Skip Kafka initialization in local environment
		if (nodeEnv === 'local') {
			this.logger.info('Kafka bootstrap skipped - NODE_ENV is "local". Kafka integration only runs in AWS environments.');
			return;
		}

		try {
			await this.bootstrapKafkaServices();
		} catch (error) {
			this.logger.error('Failed to bootstrap Kafka services', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			// Don't throw - allow application to start even if Kafka bootstrap fails
			// Services can be started manually via admin API
		}
	}

	async onApplicationShutdown(signal?: string): Promise<void> {
		const nodeEnv = this.configService.get('NODE_ENV');
		
		// Skip Kafka shutdown in local environment
		if (nodeEnv === 'local') {
			return;
		}

		try {
			await this.kafkaRuntimeManager.stopAll();
			if (signal) {
				this.logger.info(`Kafka services shut down on signal: ${signal}`);
			}
		} catch (error) {
			this.logger.error('Error during Kafka shutdown', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Bootstrap Kafka services from database.
	 * Loads enabled services and starts them.
	 */
	private async bootstrapKafkaServices(): Promise<void> {
		this.logger.info('Loading Kafka service definitions from database...');

		// Load all enabled Kafka services from database
		const serviceDefinitions = await this.kafkaServiceRepo.find({
			where: { enabled: true },
		});

		if (serviceDefinitions.length === 0) {
			this.logger.info('No enabled Kafka services found in database');
			return;
		}

		this.logger.info(`Found ${serviceDefinitions.length} enabled Kafka service(s)`, {
			count: serviceDefinitions.length,
		});

		// Build service map: map database entities to service instances
		await this.buildServiceMap(serviceDefinitions);

		// Register all services with runtime manager (using service.getId(), not entity.id)
		for (const entry of this.serviceMap.values()) {
			this.kafkaRuntimeManager.register(entry.service);
		}

		// Start all registered services in parallel. Consumers use retry-on-boot (fromBootstrap); producers start once.
		const startPromises = Array.from(this.serviceMap.values()).map((entry) =>
			entry.entity.type === KafkaServiceType.CONSUMER
				? this.startConsumerWithBootstrapRetry(entry)
				: this.startProducerOnce(entry),
		);

		await Promise.allSettled(startPromises);

		this.logger.info('Kafka services bootstrap completed');
	}

	/** Start producer once during bootstrap (no retry). */
	private async startProducerOnce(entry: { service: any; entity: KafkaServiceEntity }): Promise<void> {
		const serviceId = entry.service.getId();
		try {
			await this.kafkaRuntimeManager.start(serviceId, entry.service);
		} catch (error) {
			this.logger.error(`Failed to start service`, {
				entityId: entry.entity.id,
				serviceId,
				type: entry.entity.type,
				topic: entry.entity.topic,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	/** Bootstrap-only: start consumer with retry-on-boot for transient failures. */
	private async startConsumerWithBootstrapRetry(entry: { service: any; entity: KafkaServiceEntity }): Promise<void> {
		const serviceId = entry.service.getId();
		const entityId = entry.entity.id;
		try {
			await this.kafkaRuntimeManager.start(serviceId, entry.service, { fromBootstrap: true });
			return;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			if (this.isTerminalStartupError(error)) {
				this.logger.error(`Failed to start service (terminal)`, {
					entityId,
					serviceId,
					type: entry.entity.type,
					topic: entry.entity.topic,
					error: errorMessage,
				});
				this.kafkaRuntimeManager.markStartPermanentFailure(serviceId, errorMessage);
				return;
			}
			this.logger.warn(`Consumer startup failed (transient), starting retry loop`, {
				entityId,
				serviceId,
				topic: entry.entity.topic,
				error: errorMessage,
			});
			this.runBootstrapRetryLoop(entry).catch((err) => {
				this.logger.error(`Bootstrap retry loop exited unexpectedly`, {
					entityId,
					serviceId,
					topic: entry.entity.topic,
					error: err instanceof Error ? err.message : String(err),
				});
			});
		}
	}

	private static readonly BOOTSTRAP_RETRY_INITIAL_DELAY_MS = 2000;
	private static readonly BOOTSTRAP_RETRY_MAX_DELAY_MS = 15000;

	/** Background retry loop for one consumer during bootstrap. Stops if disabled. */
	private async runBootstrapRetryLoop(entry: { service: any; entity: KafkaServiceEntity }): Promise<void> {
		const serviceId = entry.service.getId();
		const entityId = entry.entity.id;
		let delayMs = KafkaBootstrapService.BOOTSTRAP_RETRY_INITIAL_DELAY_MS;
		let attempt = 0;

		for (;;) {
			await this.delay(delayMs);

			const entity = await this.kafkaServiceRepo.findOne({ where: { id: entityId } });
			if (!entity?.enabled) {
				this.logger.info(`Consumer disabled during bootstrap retry, stopping retry`, {
					entityId,
					serviceId,
					topic: entry.entity.topic,
				});
				return;
			}

			attempt += 1;
			try {
				await this.kafkaRuntimeManager.start(serviceId, entry.service, { fromBootstrap: true });
				this.logger.info(`Consumer started successfully after bootstrap retry`, {
					entityId,
					serviceId,
					topic: entry.entity.topic,
					attempt,
				});
				return;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				if (this.isTerminalStartupError(error)) {
					this.logger.error(`Bootstrap retry encountered terminal error`, {
						entityId,
						serviceId,
						topic: entry.entity.topic,
						attempt,
						error: errorMessage,
					});
					this.kafkaRuntimeManager.markStartPermanentFailure(serviceId, errorMessage);
					return;
				}
				this.logger.warn(`Bootstrap retry attempt failed`, {
					entityId,
					serviceId,
					topic: entry.entity.topic,
					attempt,
					nextDelayMs: Math.min(delayMs * 2, KafkaBootstrapService.BOOTSTRAP_RETRY_MAX_DELAY_MS),
					error: errorMessage,
				});
				delayMs = Math.min(delayMs * 2, KafkaBootstrapService.BOOTSTRAP_RETRY_MAX_DELAY_MS);
			}
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Terminal errors: invalid config, topic does not exist (no auto-create), or similar.
	 * Transient: REBALANCE_IN_PROGRESS, coordinator not available, timeouts, connection errors.
	 */
	private isTerminalStartupError(error: unknown): boolean {
		const msg = error instanceof Error ? error.message : String(error);
		const lower = msg.toLowerCase();
		// Invalid configuration
		if (lower.includes('is not registered') || lower.includes('must have a groupid')) return true;
		// Topic does not exist and auto-creation disabled
		if (lower.includes('topic does not exist') || lower.includes('unknown topic')) return true;
		if (lower.includes('does not exist') && (lower.includes('topic') || lower.includes('partition'))) return true;
		// Handler/config failures that are not transient
		if (lower.includes('failed to create message handler')) return true;
		return false;
	}


	/**
	 * Build service map from database entities.
	 * Maps each entity to its corresponding service instance.
	 * Uses lazy resolution via ModuleRef to break circular dependencies.
	 * 
	 * @param clear - If true, clears existing service map before building. Default: true.
	 */
	private async buildServiceMap(entities: KafkaServiceEntity[], clear: boolean = true): Promise<void> {
		if (clear) {
			this.serviceMap.clear();
		}

		for (const entity of entities) {
			// Skip if already in map
			if (this.serviceMap.has(entity.id)) {
				continue;
			}

			let service: any;

			if (entity.type === KafkaServiceType.CONSUMER) {
				// Resolve consumer services lazily using ModuleRef to break circular dependency
				service = await this.getConsumerByTopic(entity.topic);
				if (!service) {
					this.logger.warn(`Unknown consumer topic: ${entity.topic}`, {
						id: entity.id,
						topic: entity.topic,
					});
					continue;
				}
			} else if (entity.type === KafkaServiceType.PRODUCER) {
				// Map producer entities to producer service instance (lazy resolution)
				service = await this.getKafkaProducerServiceAsync();
			} else {
				this.logger.warn(`Unknown service type: ${entity.type}`, {
					id: entity.id,
					type: entity.type,
				});
				continue;
			}

			// Use entity ID as the key (not service.getId() which might differ)
			this.serviceMap.set(entity.id, { service, entity });
		}
	}

	/**
	 * Get consumer service instance by topic using lazy dynamic imports.
	 * Uses ModuleRef to resolve consumer instances after classes are loaded.
	 * This breaks the circular dependency by loading consumer classes at runtime.
	 * 
	 * @param topic - Kafka topic name
	 * @returns Consumer service instance or undefined if not found
	 */
	private async getConsumerByTopic(topic: string): Promise<any> {
		// Check cache first
		if (this.consumerCache.has(topic)) {
			return this.consumerCache.get(topic);
		}

		// Load consumer classes if not already loaded
		await this.loadConsumerClasses();

		try {
			const consumerClasses = this._consumerClasses!;
			const ConsumerClass = consumerClasses.get(topic);
			
			if (!ConsumerClass) {
				return undefined;
			}

			const consumer = this.moduleRef.get(ConsumerClass, { strict: false });
			if (consumer) {
				this.consumerCache.set(topic, consumer);
			}
			return consumer;
		} catch (error) {
			this.logger.warn(`Failed to resolve consumer for topic: ${topic}`, {
				topic,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return undefined;
		}
	}

	// Lazy-loaded consumer classes - populated on first access using dynamic imports
	private _consumerClasses: Map<string, any> | null = null;
	
	/**
	 * Load consumer classes using dynamic imports to avoid circular dependency.
	 * This is called lazily when first needed, not at module load time.
	 */
	private async loadConsumerClasses(): Promise<void> {
		if (this._consumerClasses) {
			return;
		}

		// Dynamic imports to avoid circular dependency at module load time
		const [
			{ EnterpriseAgentUpdatedConsumer },
			{ AuAgentDetailsAgentUpdatedConsumer },
			{ UkAgentDetailsAgentUpdatedConsumer },
			{ GlobalAdsAgentCreatedConsumer },
			{ GlobalAdsAgentUpdatedConsumer },
		] = await Promise.all([
			import('./consumers/enterprise-agent-updated.consumer.js'),
			import('./consumers/au-agent-details-agent-updated.consumer.js'),
			import('./consumers/uk-agent-details-agent-updated.consumer.js'),
			import('./consumers/global-ads-agent-created.consumer.js'),
			import('./consumers/global-ads-agent-updated.consumer.js'),
		]);

		this._consumerClasses = new Map<string, any>([
			['Enterprise_AgentUpdated_V2', EnterpriseAgentUpdatedConsumer],
			['AU_AgentDetails_AgentUpdated_V2', AuAgentDetailsAgentUpdatedConsumer],
			['UK_AgentDetails_AgentUpdated_V2', UkAgentDetailsAgentUpdatedConsumer],
			['Global_ADS_AgentCreated_V2', GlobalAdsAgentCreatedConsumer],
			['Global_ADS_AgentUpdated_V2', GlobalAdsAgentUpdatedConsumer],
		]);
	}

	/**
	 * Get service instance by entity ID (UUID from database).
	 * Used by admin controller to start/stop services.
	 * 
	 * Note: The runtime manager uses service.getId() (which may differ from entity.id),
	 * but the admin API uses entity.id for consistency with database records.
	 */
	getServiceByEntityId(entityId: string): { service: any; entity: KafkaServiceEntity } | undefined {
		return this.serviceMap.get(entityId);
	}

	/**
	 * Get service ID (from service.getId()) by entity ID.
	 * Used to map between entity IDs (database) and service IDs (runtime manager).
	 */
	getServiceIdByEntityId(entityId: string): string | undefined {
		const entry = this.serviceMap.get(entityId);
		return entry ? entry.service.getId() : undefined;
	}

	/**
	 * Get entity ID by service ID (reverse lookup).
	 * Used to map from runtime service ID back to database entity ID.
	 */
	getEntityIdByServiceId(serviceId: string): string | undefined {
		for (const [entityId, entry] of this.serviceMap.entries()) {
			if (entry.service.getId() === serviceId) {
				return entityId;
			}
		}
		return undefined;
	}

	/**
	 * Get service instance by topic name.
	 * Used to find consumer services for message retry.
	 * 
	 * First checks the serviceMap (services registered from database).
	 * If not found, attempts to resolve the consumer directly from the topic name.
	 * This allows retry to work even if the service isn't registered in the database.
	 * 
	 * @param topic - Kafka topic name
	 * @returns The service entry if found, undefined otherwise
	 */
	async getServiceByTopic(topic: string): Promise<{ service: any; entity: KafkaServiceEntity } | undefined> {
		// First, check serviceMap (services registered from database)
		for (const entry of this.serviceMap.values()) {
			if (entry.entity.topic === topic && entry.entity.type === KafkaServiceType.CONSUMER) {
				return entry;
			}
		}

		// If not in serviceMap, try to resolve consumer directly from topic
		// This allows retry to work even if service isn't registered in database
		const consumer = await this.getConsumerByTopic(topic);
		if (consumer) {
			// Create a mock entity for the service (not persisted, just for retry functionality)
			const mockEntity: Partial<KafkaServiceEntity> = {
				id: `retry-${topic}`,
				topic: topic,
				type: KafkaServiceType.CONSUMER,
				enabled: true,
			};
			return {
				service: consumer,
				entity: mockEntity as KafkaServiceEntity,
			};
		}

		return undefined;
	}

	/**
	 * Register a service entity that wasn't loaded during bootstrap.
	 * Used when enabling a service that was disabled at startup.
	 * 
	 * @param entity - The Kafka service entity from database
	 * @returns The service entry if successfully registered, undefined otherwise
	 */
	async registerServiceEntity(entity: KafkaServiceEntity): Promise<{ service: any; entity: KafkaServiceEntity } | undefined> {
		// Check if already in service map
		if (this.serviceMap.has(entity.id)) {
			return this.serviceMap.get(entity.id);
		}

		let serviceInstance: any;
		if (entity.type === KafkaServiceType.CONSUMER) {
			// Use lazy resolution via getConsumerByTopic
			serviceInstance = await this.getConsumerByTopic(entity.topic);
			if (!serviceInstance) {
				this.logger.warn(`Unknown consumer topic for dynamic registration: ${entity.topic}`, { entityId: entity.id });
				return undefined;
			}
		} else if (entity.type === KafkaServiceType.PRODUCER) {
			serviceInstance = await this.getKafkaProducerServiceAsync();
		} else {
			this.logger.warn(`Unknown service type for dynamic registration: ${entity.type}`, { entityId: entity.id });
			return undefined;
		}

		const entry = { service: serviceInstance, entity };
		this.serviceMap.set(entity.id, entry);
		this.kafkaRuntimeManager.register(serviceInstance);
		this.logger.info(`Dynamically registered Kafka service entity`, { entityId: entity.id, serviceId: serviceInstance.getId() });
		return entry;
	}
}

