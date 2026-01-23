import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaServiceEntity, KafkaServiceType } from '@exprealty/database';
import { KafkaRuntimeManager } from './kafka-runtime-manager.service.js';
import { EnterpriseAgentUpdatedConsumer } from './consumers/enterprise-agent-updated.consumer.js';
import { AuAgentDetailsAgentUpdatedConsumer } from './consumers/au-agent-details-agent-updated.consumer.js';
import { UkAgentDetailsAgentUpdatedConsumer } from './consumers/uk-agent-details-agent-updated.consumer.js';
import { GlobalAdsAgentCreatedConsumer } from './consumers/global-ads-agent-created.consumer.js';
import { GlobalAdsAgentUpdatedConsumer } from './consumers/global-ads-agent-updated.consumer.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';

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

	constructor(
		@InjectRepository(KafkaServiceEntity)
		private readonly kafkaServiceRepo: Repository<KafkaServiceEntity>,
		private readonly kafkaRuntimeManager: KafkaRuntimeManager,
		private readonly enterpriseAgentUpdatedConsumer: EnterpriseAgentUpdatedConsumer,
		private readonly auAgentDetailsAgentUpdatedConsumer: AuAgentDetailsAgentUpdatedConsumer,
		private readonly ukAgentDetailsAgentUpdatedConsumer: UkAgentDetailsAgentUpdatedConsumer,
		private readonly globalAdsAgentCreatedConsumer: GlobalAdsAgentCreatedConsumer,
		private readonly globalAdsAgentUpdatedConsumer: GlobalAdsAgentUpdatedConsumer,
		private readonly kafkaProducerService: KafkaProducerService,
		private readonly configService: ConfigService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaBootstrapService');
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
		this.buildServiceMap(serviceDefinitions);

		// Register all services with runtime manager (using service.getId(), not entity.id)
		for (const entry of this.serviceMap.values()) {
			this.kafkaRuntimeManager.register(entry.service);
		}

		// Start all registered services (using service.getId() for runtime manager)
		const startPromises = Array.from(this.serviceMap.values()).map(async (entry) => {
			try {
				const serviceId = entry.service.getId();
				await this.kafkaRuntimeManager.start(serviceId, entry.service);
			} catch (error) {
				this.logger.error(`Failed to start service`, {
					entityId: entry.entity.id,
					serviceId: entry.service.getId(),
					type: entry.entity.type,
					topic: entry.entity.topic,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				// Continue starting other services even if one fails
			}
		});

		await Promise.allSettled(startPromises);

		this.logger.info('Kafka services bootstrap completed');
	}

	/**
	 * Build service map from database entities.
	 * Maps each entity to its corresponding service instance.
	 * 
	 * @param clear - If true, clears existing service map before building. Default: true.
	 */
	private buildServiceMap(entities: KafkaServiceEntity[], clear: boolean = true): void {
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
				// Map consumer entities to consumer service instances
				if (entity.topic === 'Enterprise_AgentUpdated_V2') {
					service = this.enterpriseAgentUpdatedConsumer;
				} else if (entity.topic === 'AU_AgentDetails_AgentUpdated_V2') {
					service = this.auAgentDetailsAgentUpdatedConsumer;
				} else if (entity.topic === 'UK_AgentDetails_AgentUpdated_V2') {
					service = this.ukAgentDetailsAgentUpdatedConsumer;
				} else if (entity.topic === 'Global_ADS_AgentCreated_V2') {
					service = this.globalAdsAgentCreatedConsumer;
				} else if (entity.topic === 'Global_ADS_AgentUpdated_V2') {
					service = this.globalAdsAgentUpdatedConsumer;
				} else {
					this.logger.warn(`Unknown consumer topic: ${entity.topic}`, {
						id: entity.id,
						topic: entity.topic,
					});
					continue;
				}
			} else if (entity.type === KafkaServiceType.PRODUCER) {
				// Map producer entities to producer service instance
				service = this.kafkaProducerService;
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
	 * Register a service entity that wasn't loaded during bootstrap.
	 * Used when enabling a service that was disabled at startup.
	 * 
	 * @param entity - The Kafka service entity from database
	 * @returns The service entry if successfully registered, undefined otherwise
	 */
	registerServiceEntity(entity: KafkaServiceEntity): { service: any; entity: KafkaServiceEntity } | undefined {
		// Check if already in service map
		if (this.serviceMap.has(entity.id)) {
			return this.serviceMap.get(entity.id);
		}

		let serviceInstance: any;
		if (entity.type === KafkaServiceType.CONSUMER) {
			if (entity.topic === 'Enterprise_AgentUpdated_V2') {
				serviceInstance = this.enterpriseAgentUpdatedConsumer;
			} else if (entity.topic === 'AU_AgentDetails_AgentUpdated_V2') {
				serviceInstance = this.auAgentDetailsAgentUpdatedConsumer;
			} else if (entity.topic === 'UK_AgentDetails_AgentUpdated_V2') {
				serviceInstance = this.ukAgentDetailsAgentUpdatedConsumer;
			} else if (entity.topic === 'Global_ADS_AgentCreated_V2') {
				serviceInstance = this.globalAdsAgentCreatedConsumer;
			} else if (entity.topic === 'Global_ADS_AgentUpdated_V2') {
				serviceInstance = this.globalAdsAgentUpdatedConsumer;
			} else {
				this.logger.warn(`Unknown consumer topic for dynamic registration: ${entity.topic}`, { entityId: entity.id });
				return undefined;
			}
		} else if (entity.type === KafkaServiceType.PRODUCER) {
			serviceInstance = this.kafkaProducerService;
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

