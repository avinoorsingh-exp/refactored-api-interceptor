import { Injectable } from '@nestjs/common';
import { Consumer, Producer, KafkaMessage } from 'kafkajs';
import { LoggerService } from '../../core/logger.service.js';
import { KafkaClientService } from './kafka-client.service.js';
import { AsyncContextStorage, CorrelationIdHelper, RequestContext } from '@exprealty/cache';

/**
 * Runtime status for a Kafka service.
 */
export enum KafkaServiceStatus {
	RUNNING = 'running',
	STOPPED = 'stopped',
	ERROR = 'error',
	ATTACHED = 'attached', // Service is attached to a shared consumer
}

/**
 * Runtime registry entry for a Kafka service.
 * Tracks in-memory state only - NOT persisted to database.
 */
export interface KafkaServiceRuntime {
	id: string;
	type: 'consumer' | 'producer';
	topic: string;
	groupId?: string;
	status: KafkaServiceStatus;
	startedAt?: Date;
	error?: string;
	instance?: Consumer | Producer;
}

/**
 * Message handler function type for routing messages to services.
 * Matches KafkaJS EachMessageHandler signature.
 */
type MessageHandler = (payload: { topic: string; partition: number; message: KafkaMessage }) => Promise<void>;

/**
 * Group-based consumer registry entry.
 * 
 * CRITICAL: Kafka consumer groups only allow ONE active consumer instance per groupId.
 * Multiple services with the same groupId must share a single Consumer instance.
 * This structure enforces that constraint.
 */
interface GroupConsumerRegistry {
	consumerInstance: Consumer;
	groupId: string;
	topics: Set<string>; // Topics currently subscribed
	services: Set<string>; // Service IDs attached to this consumer
	messageHandlers: Map<string, MessageHandler>; // topic -> handler function
	status: KafkaServiceStatus;
	startedAt: Date;
}

/**
 * Interface for services that can be registered with KafkaRuntimeManager.
 */
export interface RegisterableKafkaService {
	/**
	 * Unique identifier for the service.
	 */
	getId(): string;

	/**
	 * Service type (consumer or producer).
	 */
	getType(): 'consumer' | 'producer';

	/**
	 * Kafka topic name.
	 */
	getTopic(): string;

	/**
	 * Consumer group ID (nullable for producers).
	 */
	getGroupId(): string | undefined;

	/**
	 * Start the service.
	 * For consumers: Returns Consumer instance but does NOT call consumer.run().
	 * The runtime manager will call consumer.run() with a message router.
	 * For producers: Returns Producer instance.
	 */
	start(): Promise<Consumer | Producer>;

	/**
	 * Stop the service gracefully.
	 */
	stop(): Promise<void>;

	/**
	 * Get message handler for this service (consumers only).
	 * Used by runtime manager to route messages to the correct handler.
	 * Returns a function matching KafkaJS EachMessageHandler signature.
	 * 
	 * @returns Message handler function, or undefined for producers
	 */
	getMessageHandler?(): ((payload: { topic: string; partition: number; message: KafkaMessage }) => Promise<void>) | undefined;
}

/**
 * Kafka Runtime Manager
 * 
 * Manages runtime state of Kafka consumers and producers in memory.
 * Provides centralized registration, starting, and stopping of Kafka services.
 * 
 * CRITICAL ARCHITECTURE:
 * - Kafka consumer groups enforce ONE active consumer instance per groupId
 * - Multiple services with the same groupId MUST share a single Consumer instance
 * - This manager enforces that constraint by keying consumers by groupId
 * 
 * Runtime state is NOT persisted to the database - only service definitions are stored.
 */
@Injectable()
export class KafkaRuntimeManager {
	/**
	 * Service-level registry for UI visibility and service management.
	 * Key: serviceId
	 */
	private readonly registry = new Map<string, KafkaServiceRuntime>();

	/**
	 * Group-based consumer registry for enforcing singleton Consumer instances.
	 * Key: groupId (only for consumers)
	 * 
	 * This ensures only ONE Consumer instance exists per groupId, even when
	 * multiple services share the same groupId and subscribe to different topics.
	 */
	private readonly groupConsumers = new Map<string, GroupConsumerRegistry>();

	/**
	 * Locks for consumer group creation to prevent race conditions when services start in parallel.
	 * Key: groupId
	 * Value: Promise that resolves when the group is ready
	 */
	private readonly groupCreationLocks = new Map<string, Promise<GroupConsumerRegistry>>();

	private readonly logger: LoggerService;
	private readonly kafkaClientService: KafkaClientService;

	constructor(
		loggerService: LoggerService,
		kafkaClientService: KafkaClientService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaRuntimeManager');
		this.kafkaClientService = kafkaClientService;
	}

	/**
	 * Register a Kafka service with the runtime manager.
	 * Does not start the service - use start() to begin processing.
	 * 
	 * @param service - The service to register
	 */
	register(service: RegisterableKafkaService): void {
		const id = service.getId();
		
		if (this.registry.has(id)) {
			this.logger.warn(`Service ${id} is already registered - skipping registration`, {
				id,
				type: service.getType(),
				topic: service.getTopic(),
			});
			return;
		}

		const runtime: KafkaServiceRuntime = {
			id,
			type: service.getType(),
			topic: service.getTopic(),
			groupId: service.getGroupId(),
			status: KafkaServiceStatus.STOPPED,
		};

		this.registry.set(id, runtime);
		this.logger.info(`Registered Kafka service`, {
			id,
			type: runtime.type,
			topic: runtime.topic,
			groupId: runtime.groupId,
		});
	}

	/**
	 * Start a registered Kafka service.
	 * 
	 * CRITICAL: For consumers with the same groupId, this enforces a singleton Consumer instance.
	 * Multiple services sharing a groupId will attach to the same Consumer and subscribe to
	 * their respective topics. Messages are routed to the correct service handler by topic.
	 * 
	 * Idempotent - safe to call multiple times.
	 * 
	 * @param id - Service ID
	 * @param service - The service instance (required for starting)
	 */
	async start(id: string, service: RegisterableKafkaService): Promise<void> {
		const runtime = this.registry.get(id);
		
		if (!runtime) {
			throw new Error(`Service ${id} is not registered`);
		}

		if (runtime.status === KafkaServiceStatus.RUNNING || runtime.status === KafkaServiceStatus.ATTACHED) {
			this.logger.info(`Service ${id} is already running/attached - skipping start`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
				status: runtime.status,
			});
			return;
		}

		try {
			// Producers are straightforward - one instance per service
			if (runtime.type === 'producer') {
				this.logger.info(`Starting Kafka producer`, {
					id,
					topic: runtime.topic,
				});

				const instance = await service.start() as Producer;
				runtime.instance = instance;
				runtime.status = KafkaServiceStatus.RUNNING;
				runtime.startedAt = new Date();
				runtime.error = undefined;

				this.logger.info(`Kafka producer started successfully`, {
					id,
					topic: runtime.topic,
					startedAt: runtime.startedAt,
				});
				return;
			}

			// Consumers require groupId-based singleton enforcement
			const groupId = runtime.groupId;
			if (!groupId) {
				throw new Error(`Consumer service ${id} must have a groupId`);
			}

			// Check if a consumer with this groupId already exists or is being created
			this.logger.info(`Checking for existing consumer group`, {
				serviceId: id,
				groupId,
				topic: runtime.topic,
				existingGroupIds: Array.from(this.groupConsumers.keys()),
				registrySize: this.groupConsumers.size,
				activeLocks: Array.from(this.groupCreationLocks.keys()),
			});
			
			// Check if group is being created (race condition protection)
			const creationLock = this.groupCreationLocks.get(groupId);
			if (creationLock) {
				// Wait for the group to be created, then attach
				this.logger.info(`Consumer group is being created by another service - waiting for creation to complete`, {
					serviceId: id,
					groupId,
					topic: runtime.topic,
				});
				await creationLock;
			}
			
			const existingGroup = this.groupConsumers.get(groupId);

			if (existingGroup) {
				// Attach to existing consumer - do NOT create a new Consumer instance
				this.logger.info(`Attaching service to existing consumer group`, {
					serviceId: id,
					groupId,
					topic: runtime.topic,
					existingTopics: Array.from(existingGroup.topics),
					existingServices: Array.from(existingGroup.services),
				});

				// Add service to the group
				existingGroup.services.add(id);
				
				// CRITICAL: KafkaJS does not allow topics to be added after consumer.run() has started.
				// Any change to the logical subscription set MUST result in a consumer restart
				// so KafkaJS re-subscribes correctly. Even if the topic appears in the topics set,
				// we must restart to ensure the consumer is actually subscribed and will receive messages.
				const topicAlreadyTracked = existingGroup.topics.has(runtime.topic);
				if (topicAlreadyTracked) {
					this.logger.info(`Topic ${runtime.topic} found in topics set, but restarting consumer group to ensure active subscription`, {
						groupId,
						subscribedTopics: Array.from(existingGroup.topics),
						topic: runtime.topic,
					});
				} else {
					this.logger.info(`Topic ${runtime.topic} not in subscribed topics - restarting consumer group to add topic`, {
						groupId,
						subscribedTopics: Array.from(existingGroup.topics),
						newTopic: runtime.topic,
					});
				}
				
				// Always restart the consumer group when attaching a new service
				// This ensures the consumer is properly subscribed to all topics before run()
				await this.restartConsumerGroup(groupId, runtime.topic, service);
				
				// Get the updated group registry after restart
				const updatedGroup = this.groupConsumers.get(groupId);
				if (!updatedGroup) {
					throw new Error(`Consumer group ${groupId} was lost during restart`);
				}
				
				// Verify the topic is now in the subscribed topics after restart
				if (!updatedGroup.topics.has(runtime.topic)) {
					this.logger.error(`Failed to add topic to consumer group after restart`, {
						groupId,
						topic: runtime.topic,
						subscribedTopics: Array.from(updatedGroup.topics),
					});
					throw new Error(`Failed to subscribe to topic ${runtime.topic} - consumer group restart failed`);
				}

				// Register message handler for this topic
				// This is what actually enables message processing for this service
				// CRITICAL: Always register/re-register the handler to ensure it's present
				// This handles cases where the handler might have been lost or not registered
				const handler = await this.createMessageHandler(service, runtime.topic);
				if (!handler) {
					throw new Error(`Failed to create message handler for topic ${runtime.topic}`);
				}
				
				// Always set the handler (even if one exists, replace it to ensure it's correct)
				const hadExistingHandler = updatedGroup.messageHandlers.has(runtime.topic);
				updatedGroup.messageHandlers.set(runtime.topic, handler);
				
				this.logger.info(`Registered message handler for topic`, {
					groupId,
					topic: runtime.topic,
					serviceId: id,
					totalHandlers: updatedGroup.messageHandlers.size,
					registeredTopics: Array.from(updatedGroup.messageHandlers.keys()),
					hadExistingHandler,
				});

				// Update service runtime to reflect attachment
				runtime.instance = updatedGroup.consumerInstance;
				runtime.status = KafkaServiceStatus.ATTACHED;
				runtime.startedAt = updatedGroup.startedAt; // Use group's start time
				runtime.error = undefined;

				this.logger.info(`Service attached to consumer group successfully`, {
					serviceId: id,
					groupId,
					topic: runtime.topic,
					totalServices: updatedGroup.services.size,
					totalTopics: updatedGroup.topics.size,
				});
			} else {
				// Create new consumer group - this is the first service with this groupId
				// Use a lock to prevent race conditions when multiple services start in parallel
				let creationPromise = this.groupCreationLocks.get(groupId);
				
				if (!creationPromise) {
					// We're the first one - create the lock and the group
					creationPromise = this.createConsumerGroup(id, service, runtime, groupId);
					this.groupCreationLocks.set(groupId, creationPromise);
					
					// Clean up the lock after creation completes
					creationPromise.finally(() => {
						this.groupCreationLocks.delete(groupId);
					});
				}
				
				// Wait for group creation (either ours or another service's)
				await creationPromise;
				
				// After creation, we should attach (the group should exist now)
				const createdGroup = this.groupConsumers.get(groupId);
				if (!createdGroup) {
					throw new Error(`Consumer group ${groupId} was not created successfully`);
				}
				
				// Always ensure this service is attached and handler is registered
				// Even if we created the group, we might not have registered the handler yet
				if (!createdGroup.services.has(id)) {
					// Add service to the group
					createdGroup.services.add(id);
					this.logger.info(`Added service to consumer group`, {
						serviceId: id,
						groupId,
						topic: runtime.topic,
					});
				}
				
				// CRITICAL: Always ensure handler is registered, even if service is already in the group
				// This handles the case where the group was created but handler wasn't registered
				if (!createdGroup.messageHandlers.has(runtime.topic)) {
					this.logger.info(`Registering message handler for topic (was missing)`, {
						serviceId: id,
						groupId,
						topic: runtime.topic,
						existingHandlers: Array.from(createdGroup.messageHandlers.keys()),
					});
					
					const handler = await this.createMessageHandler(service, runtime.topic);
					createdGroup.messageHandlers.set(runtime.topic, handler);
					
					this.logger.info(`Registered message handler for topic after group creation`, {
						groupId,
						topic: runtime.topic,
						serviceId: id,
						totalHandlers: createdGroup.messageHandlers.size,
						registeredTopics: Array.from(createdGroup.messageHandlers.keys()),
					});
				} else {
					this.logger.info(`Message handler already registered for topic`, {
						groupId,
						topic: runtime.topic,
						serviceId: id,
						registeredTopics: Array.from(createdGroup.messageHandlers.keys()),
					});
				}
				
				// Update service runtime to reflect attachment
				runtime.instance = createdGroup.consumerInstance;
				runtime.status = createdGroup.services.size === 1 ? KafkaServiceStatus.RUNNING : KafkaServiceStatus.ATTACHED;
				runtime.startedAt = createdGroup.startedAt;
				runtime.error = undefined;
				
				this.logger.info(`Service attached to consumer group after creation`, {
					serviceId: id,
					groupId,
					topic: runtime.topic,
					totalServices: createdGroup.services.size,
					totalTopics: createdGroup.topics.size,
					registeredHandlers: Array.from(createdGroup.messageHandlers.keys()),
				});
			}
		} catch (error) {
			runtime.status = KafkaServiceStatus.ERROR;
			runtime.error = error instanceof Error ? error.message : String(error);
			runtime.startedAt = undefined;

			this.logger.error(`Failed to start Kafka service`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
				error: runtime.error,
				stack: error instanceof Error ? error.stack : undefined,
			});

			throw error;
		}
	}

	/**
	 * Create a new consumer group (internal helper to prevent race conditions).
	 * This is called with a lock to ensure only one service creates the group.
	 */
	private async createConsumerGroup(
		id: string,
		service: RegisterableKafkaService,
		runtime: KafkaServiceRuntime,
		groupId: string,
	): Promise<GroupConsumerRegistry> {
		this.logger.info(`Creating new consumer group`, {
			serviceId: id,
			groupId,
			topic: runtime.topic,
		});

		const instance = await service.start() as Consumer;
		
		// CRITICAL: Subscribe to ALL topics that might be used by this groupId
		// This ensures we don't have issues with dynamic subscriptions after consumer.run()
		// Find all registered services with the same groupId to subscribe upfront
		const allTopicsForGroup = Array.from(this.registry.values())
			.filter(r => r.groupId === groupId && r.type === 'consumer')
			.map(r => r.topic);
		
		// Remove duplicates and ensure current topic is included
		const uniqueTopics = Array.from(new Set([...allTopicsForGroup, runtime.topic]));
		
		// Subscribe to all topics at once BEFORE calling consumer.run()
		if (uniqueTopics.length > 0) {
			await instance.subscribe({ 
				topics: uniqueTopics,  // Subscribe to all topics upfront
				fromBeginning: false 
			});
			this.logger.info(`Subscribed consumer to all topics for group`, {
				groupId,
				topics: uniqueTopics,
			});
		}
		
		// Create group registry entry with all topics
		const handler = await this.createMessageHandler(service, runtime.topic);
		const groupRegistry: GroupConsumerRegistry = {
			consumerInstance: instance,
			groupId,
			topics: new Set(uniqueTopics),  // Track all subscribed topics
			services: new Set([id]),
			messageHandlers: new Map([[runtime.topic, handler]]),
			status: KafkaServiceStatus.RUNNING,
			startedAt: new Date(),
		};

		this.groupConsumers.set(groupId, groupRegistry);

		// Update service runtime
		runtime.instance = instance;
		runtime.status = KafkaServiceStatus.RUNNING;
		runtime.startedAt = groupRegistry.startedAt;
		runtime.error = undefined;

		// Set up message routing for the shared consumer
		// This calls consumer.run() AFTER all topics are subscribed
		this.setupMessageRouting(groupRegistry);

		this.logger.info(`Consumer group created successfully`, {
			serviceId: id,
			groupId,
			topic: runtime.topic,
			allTopics: uniqueTopics,
			registeredHandlers: Array.from(groupRegistry.messageHandlers.keys()),
		});
		
		return groupRegistry;
	}

	/**
	 * Create a message handler that routes to the service's handleMessage method.
	 */
	private async createMessageHandler(
		service: RegisterableKafkaService,
		topic: string,
	): Promise<MessageHandler> {
		if (service.getMessageHandler) {
			const handler = service.getMessageHandler();
			if (handler) {
				// Wrap the handler to match KafkaJS EachMessageHandler signature
				return async (payload: { topic: string; partition: number; message: KafkaMessage }) => {
					await handler(payload);
				};
			}
		}

		// Fallback: return a handler that logs and does nothing
		// This should not happen if consumers are properly updated
		this.logger.warn('Service does not expose message handler - messages will be dropped', {
			serviceId: service.getId(),
			topic,
		});

		return async (payload: { topic: string; partition: number; message: KafkaMessage }) => {
			this.logger.warn('Message received but no handler available', {
				topic: payload.topic,
				expectedTopic: topic,
				serviceId: service.getId(),
			});
		};
	}

	/**
	 * Restart a consumer group to add a new topic.
	 * 
	 * CRITICAL: KafkaJS does not allow topics to be added after consumer.run() has started.
	 * Any change to the logical subscription set MUST result in a consumer restart
	 * so KafkaJS re-subscribes correctly.
	 * 
	 * This method is idempotent - calling it multiple times with the same topic is safe.
	 * It preserves all existing handlers and services, ensuring no message processing is lost.
	 * 
	 * The restart process:
	 * 1. Preserves all existing handlers and services
	 * 2. Disconnects the current consumer cleanly
	 * 3. Creates a new consumer instance
	 * 4. Subscribes to all topics (existing + new) BEFORE calling run()
	 * 5. Restores all handlers and services
	 * 6. Restarts message routing
	 * 
	 * @param groupId - The consumer group ID
	 * @param newTopic - The new topic to add (will be added to existing topics)
	 * @param service - The service instance to use for creating a new consumer
	 */
	private async restartConsumerGroup(groupId: string, newTopic: string, service: RegisterableKafkaService): Promise<void> {
		const groupRegistry = this.groupConsumers.get(groupId);
		if (!groupRegistry) {
			throw new Error(`Consumer group ${groupId} not found`);
		}

		this.logger.info(`Restarting consumer group to add new topic`, {
			groupId,
			newTopic,
			existingTopics: Array.from(groupRegistry.topics),
			services: Array.from(groupRegistry.services),
		});

		// Preserve existing handlers and services
		const existingHandlers = new Map(groupRegistry.messageHandlers);
		const existingServices = new Set(groupRegistry.services);
		const existingStartTime = groupRegistry.startedAt;

		// Disconnect the current consumer
		try {
			await groupRegistry.consumerInstance.disconnect();
			this.logger.info(`Disconnected existing consumer for group restart`, {
				groupId,
			});
		} catch (error) {
			this.logger.warn(`Error disconnecting consumer during restart (may already be disconnected)`, {
				groupId,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}

		// Get all topics that should be subscribed (existing + new)
		const allTopics = Array.from(new Set([...Array.from(groupRegistry.topics), newTopic]));

		// Create a new consumer instance using the service
		// The service.start() method will create a new consumer with the same groupId
		const newConsumer = await service.start() as Consumer;

		// Subscribe to all topics (including the new one) BEFORE calling consumer.run()
		await newConsumer.subscribe({
			topics: allTopics,
			fromBeginning: false,
		});

		this.logger.info(`Subscribed new consumer to all topics (including new topic)`, {
			groupId,
			topics: allTopics,
		});

		// Update the group registry with the new consumer and topics
		groupRegistry.consumerInstance = newConsumer;
		groupRegistry.topics = new Set(allTopics);
		// Restore preserved handlers and services
		groupRegistry.messageHandlers = existingHandlers;
		groupRegistry.services = existingServices;

		// Update all service runtimes to point to the new consumer instance
		for (const serviceId of existingServices) {
			const serviceRuntime = this.registry.get(serviceId);
			if (serviceRuntime) {
				serviceRuntime.instance = newConsumer;
				serviceRuntime.startedAt = existingStartTime; // Preserve original start time
			}
		}

		// Restart message routing with the new consumer
		// This must happen AFTER handlers are restored so the router can find them
		this.setupMessageRouting(groupRegistry);

		this.logger.info(`Consumer group restarted successfully with new topic`, {
			groupId,
			newTopic,
			allTopics: Array.from(allTopics),
			totalServices: existingServices.size,
		});
	}

	/**
	 * Set up message routing for a consumer group.
	 * Routes messages to the correct service handler based on topic.
	 * 
	 * This is called when the first consumer in a group starts.
	 * The routing handler dispatches messages to the appropriate service handler.
	 * 
	 * CRITICAL: Consumers should NOT call consumer.run() themselves.
	 * The runtime manager handles this to ensure proper message routing.
	 */
	private setupMessageRouting(groupRegistry: GroupConsumerRegistry): void {
		const consumer = groupRegistry.consumerInstance;
		
		// Create a router that dispatches messages to the correct handler
		const router: MessageHandler = async (payload: { topic: string; partition: number; message: KafkaMessage }) => {
			// Wrap each message in its own async context to ensure logger context isolation
			// Each message gets its own correlation ID and logger context
			const correlationId = CorrelationIdHelper.generateCorrelationId();
			
			// Get the service name from the handler's topic (for logger context)
			const handler = groupRegistry.messageHandlers.get(payload.topic);
			const serviceName = this.getServiceNameForTopic(payload.topic);
			
			// Create async context for this message with logger context
			const context: RequestContext = {
				correlationId,
				timestamp: Date.now(),
				loggerContext: {
					serviceName,
					sourceType: 'kafka',
					kafkaTopic: payload.topic,
					kafkaPartition: payload.partition,
					kafkaOffset: payload.message.offset,
				},
			};
			
			await AsyncContextStorage.run(context, async () => {
				try {
					this.logger.debug('Message router received message', {
						groupId: groupRegistry.groupId,
						topic: payload.topic,
						partition: payload.partition,
						offset: payload.message.offset,
						registeredHandlers: Array.from(groupRegistry.messageHandlers.keys()),
						subscribedTopics: Array.from(groupRegistry.topics),
					});
					
					if (handler) {
						this.logger.debug('Calling handler for topic', {
							groupId: groupRegistry.groupId,
							topic: payload.topic,
						});
						await handler(payload);
					} else {
						this.logger.warn('Message received for topic with no registered handler', {
							groupId: groupRegistry.groupId,
							topic: payload.topic,
							registeredTopics: Array.from(groupRegistry.messageHandlers.keys()),
							subscribedTopics: Array.from(groupRegistry.topics),
						});
					}
				} catch (error) {
					// Catch any unhandled errors in message processing to prevent consumer crash
					this.logger.error('Error in message router - handler threw unhandled exception', {
						groupId: groupRegistry.groupId,
						topic: payload.topic,
						partition: payload.partition,
						offset: payload.message.offset,
						error: error instanceof Error ? error.message : 'Unknown error',
						stack: error instanceof Error ? error.stack : undefined,
					});
					// Re-throw to let KafkaJS handle it (it will log and continue)
					throw error;
				}
			});
		};

		// Start the consumer with the router
		// NOTE: Consumers should NOT call consumer.run() in their start() method.
		// The runtime manager handles this to ensure proper multi-topic routing.
		
		consumer.run({
			eachMessage: router,
		}).catch((error) => {
			this.logger.error('Consumer run() promise rejected', {
				groupId: groupRegistry.groupId,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
		});

		this.logger.info('Message routing set up for consumer group', {
			groupId: groupRegistry.groupId,
			topics: Array.from(groupRegistry.topics),
		});
	}

	/**
	 * Stop a registered Kafka service.
	 * 
	 * CRITICAL: For consumers sharing a groupId, this detaches the service from the shared consumer.
	 * The Consumer instance is only disconnected when NO services remain attached to it.
	 * 
	 * Idempotent - safe to call multiple times.
	 * 
	 * @param id - Service ID
	 * @param service - The service instance (required for stopping)
	 */
	async stop(id: string, service: RegisterableKafkaService): Promise<void> {
		const runtime = this.registry.get(id);
		
		if (!runtime) {
			throw new Error(`Service ${id} is not registered`);
		}

		if (runtime.status === KafkaServiceStatus.STOPPED) {
			this.logger.info(`Service ${id} is already stopped - skipping stop`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
			});
			return;
		}

		try {
			// Producers are straightforward - just stop them
			if (runtime.type === 'producer') {
				this.logger.info(`Stopping Kafka producer`, {
					id,
					topic: runtime.topic,
				});

				await service.stop();
				runtime.instance = undefined;
				runtime.status = KafkaServiceStatus.STOPPED;
				runtime.startedAt = undefined;
				runtime.error = undefined;

				this.logger.info(`Kafka producer stopped successfully`, {
					id,
					topic: runtime.topic,
				});
				return;
			}

			// Consumers require group-based handling
			const groupId = runtime.groupId;
			if (!groupId) {
				throw new Error(`Consumer service ${id} must have a groupId`);
			}

			const groupRegistry = this.groupConsumers.get(groupId);
			if (!groupRegistry) {
				this.logger.warn(`No group registry found for groupId ${groupId} - service may be in inconsistent state`, {
					serviceId: id,
					groupId,
				});
				// Fall through to standard stop
				await service.stop();
				runtime.instance = undefined;
				runtime.status = KafkaServiceStatus.STOPPED;
				runtime.startedAt = undefined;
				runtime.error = undefined;
				return;
			}

			// Detach service from group
			groupRegistry.services.delete(id);
			
			// CRITICAL: Remove the message handler so this service stops receiving messages
			// Check if other services are using the same topic before removing handler
			const otherServicesUsingTopic = Array.from(groupRegistry.services).some(
				serviceId => {
					const otherRuntime = this.registry.get(serviceId);
					return otherRuntime?.topic === runtime.topic;
				}
			);
			
			if (!otherServicesUsingTopic) {
				// No other services are using this topic, remove the handler
				groupRegistry.messageHandlers.delete(runtime.topic);
				this.logger.info(`Removed message handler for topic (no other services using it)`, {
					groupId,
					topic: runtime.topic,
				});
			} else {
				// Other services are still using this topic, keep the handler
				this.logger.info(`Keeping message handler for topic (other services still using it)`, {
					groupId,
					topic: runtime.topic,
					remainingServices: Array.from(groupRegistry.services),
				});
			}

			this.logger.info(`Detaching service from consumer group`, {
				serviceId: id,
				groupId,
				topic: runtime.topic,
				remainingServices: groupRegistry.services.size,
				handlerRemoved: !otherServicesUsingTopic,
			});

			// Update service runtime
			runtime.instance = undefined;
			runtime.status = KafkaServiceStatus.STOPPED;
			runtime.startedAt = undefined;
			runtime.error = undefined;

			// Only disconnect the Consumer if NO services remain attached
			if (groupRegistry.services.size === 0) {
				this.logger.info(`No services remain in consumer group - disconnecting consumer`, {
					groupId,
				});

				try {
					await groupRegistry.consumerInstance.disconnect();
					this.groupConsumers.delete(groupId);
					this.logger.info(`Consumer group disconnected and removed`, {
						groupId,
					});
				} catch (error) {
					this.logger.error(`Error disconnecting consumer group`, {
						groupId,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
					// Still remove from registry even if disconnect fails
					this.groupConsumers.delete(groupId);
					throw error;
				}
			} else {
				// Other services still using this consumer - just unsubscribe from this topic
				// Note: KafkaJS doesn't support unsubscribing from individual topics
				// The consumer will continue to receive messages for all subscribed topics
				// but we've removed the handler, so messages for this topic will be ignored
				this.logger.info(`Consumer group still in use - keeping consumer running`, {
					groupId,
					remainingServices: Array.from(groupRegistry.services),
					remainingTopics: Array.from(groupRegistry.topics),
				});
			}

			this.logger.info(`Service detached from consumer group successfully`, {
				serviceId: id,
				groupId,
				consumerStillRunning: groupRegistry.services.size > 0,
			});
		} catch (error) {
			runtime.status = KafkaServiceStatus.ERROR;
			runtime.error = error instanceof Error ? error.message : String(error);
			
			this.logger.error(`Failed to stop Kafka service`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
				error: runtime.error,
				stack: error instanceof Error ? error.stack : undefined,
			});

			// Still clear the instance even if stop failed
			runtime.instance = undefined;
			runtime.startedAt = undefined;

			throw error;
		}
	}

	/**
	 * Get runtime state for a specific service.
	 * 
	 * @param id - Service ID
	 * @returns Runtime state or undefined if not registered
	 */
	getRuntime(id: string): KafkaServiceRuntime | undefined {
		return this.registry.get(id);
	}

	/**
	 * Get all registered services' runtime state.
	 * 
	 * @returns Array of runtime states
	 */
	getAllRuntimes(): KafkaServiceRuntime[] {
		return Array.from(this.registry.values());
	}

	/**
	 * Get service name for a topic (for logger context).
	 * Maps topic to the registered service's ID.
	 * 
	 * @param topic - Kafka topic name
	 * @returns Service name or 'KafkaRuntimeManager' as fallback
	 */
	private getServiceNameForTopic(topic: string): string {
		// Find the service that handles this topic
		for (const runtime of this.registry.values()) {
			if (runtime.topic === topic) {
				return runtime.id;
			}
		}
		// Fallback to runtime manager name
		return 'KafkaRuntimeManager';
	}

	/**
	 * Stop all running services gracefully.
	 * Used during application shutdown.
	 */
	async stopAll(): Promise<void> {
		// Disconnect all consumer groups (this handles all consumers sharing groupIds)
		const groupStopPromises = Array.from(this.groupConsumers.values()).map(async (group) => {
			try {
				await group.consumerInstance.disconnect();
				this.logger.info('Consumer group disconnected', {
					groupId: group.groupId,
				});
			} catch (error) {
				this.logger.error('Error disconnecting consumer group', {
					groupId: group.groupId,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		});

		// Disconnect all producers
		const producerRuntimes = Array.from(this.registry.values()).filter(
			(runtime) => runtime.type === 'producer' && runtime.status === KafkaServiceStatus.RUNNING,
		);

		const producerStopPromises = producerRuntimes.map(async (runtime) => {
			try {
				if (runtime.instance) {
					await (runtime.instance as Producer).disconnect();
					runtime.instance = undefined;
					runtime.status = KafkaServiceStatus.STOPPED;
					runtime.startedAt = undefined;
					runtime.error = undefined;
				}
			} catch (error) {
				this.logger.error(`Error stopping producer ${runtime.id}`, {
					id: runtime.id,
					topic: runtime.topic,
					error: error instanceof Error ? error.message : String(error),
				});
				runtime.status = KafkaServiceStatus.ERROR;
				runtime.error = error instanceof Error ? error.message : String(error);
			}
		});

		// Update all service runtimes to stopped
		for (const runtime of this.registry.values()) {
			if (runtime.status === KafkaServiceStatus.RUNNING || runtime.status === KafkaServiceStatus.ATTACHED) {
				runtime.instance = undefined;
				runtime.status = KafkaServiceStatus.STOPPED;
				runtime.startedAt = undefined;
				runtime.error = undefined;
			}
		}

		await Promise.allSettled([...groupStopPromises, ...producerStopPromises]);

		// Clear registries
		this.groupConsumers.clear();

		this.logger.info('All Kafka services stopped');
	}

	/**
	 * Check if a service is registered.
	 * 
	 * @param id - Service ID
	 * @returns True if registered, false otherwise
	 */
	isRegistered(id: string): boolean {
		return this.registry.has(id);
	}

	/**
	 * Get group consumer registry for a groupId.
	 * Used internally for debugging and monitoring.
	 */
	getGroupConsumer(groupId: string): GroupConsumerRegistry | undefined {
		return this.groupConsumers.get(groupId);
	}
}


