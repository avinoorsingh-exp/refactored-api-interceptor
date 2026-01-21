import { Injectable } from '@nestjs/common';
import { Consumer, Producer } from 'kafkajs';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Runtime status for a Kafka service.
 */
export enum KafkaServiceStatus {
	RUNNING = 'running',
	STOPPED = 'stopped',
	ERROR = 'error',
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
	 * Returns the KafkaJS instance (Consumer or Producer).
	 */
	start(): Promise<Consumer | Producer>;

	/**
	 * Stop the service gracefully.
	 */
	stop(): Promise<void>;
}

/**
 * Kafka Runtime Manager
 * 
 * Manages runtime state of Kafka consumers and producers in memory.
 * Provides centralized registration, starting, and stopping of Kafka services.
 * 
 * Runtime state is NOT persisted to the database - only service definitions are stored.
 */
@Injectable()
export class KafkaRuntimeManager {
	private readonly registry = new Map<string, KafkaServiceRuntime>();
	private readonly logger: LoggerService;

	constructor(loggerService: LoggerService) {
		this.logger = loggerService;
		this.logger.setContext('KafkaRuntimeManager');
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

		if (runtime.status === KafkaServiceStatus.RUNNING) {
			this.logger.info(`Service ${id} is already running - skipping start`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
			});
			return;
		}

		try {
			this.logger.info(`Starting Kafka service`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
				groupId: runtime.groupId,
			});

			const instance = await service.start();
			runtime.instance = instance;
			runtime.status = KafkaServiceStatus.RUNNING;
			runtime.startedAt = new Date();
			runtime.error = undefined;

			this.logger.info(`Kafka service started successfully`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
				startedAt: runtime.startedAt,
			});
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
	 * Stop a registered Kafka service.
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
			this.logger.info(`Stopping Kafka service`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
				groupId: runtime.groupId,
			});

			await service.stop();
			runtime.instance = undefined;
			runtime.status = KafkaServiceStatus.STOPPED;
			runtime.startedAt = undefined;
			runtime.error = undefined;

			this.logger.info(`Kafka service stopped successfully`, {
				id,
				type: runtime.type,
				topic: runtime.topic,
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
	 * Stop all running services gracefully.
	 * Used during application shutdown.
	 */
	async stopAll(): Promise<void> {
		const runningServices = Array.from(this.registry.values()).filter(
			(runtime) => runtime.status === KafkaServiceStatus.RUNNING,
		);

		if (runningServices.length === 0) {
			this.logger.info('No running Kafka services to stop');
			return;
		}

		this.logger.info(`Stopping ${runningServices.length} Kafka service(s)`, {
			count: runningServices.length,
		});

		// Stop all services in parallel
		const stopPromises = runningServices.map(async (runtime) => {
			try {
				// We need the service instance to call stop(), but we only have the runtime
				// This method is called during shutdown, so we'll disconnect the instances directly
				if (runtime.instance) {
					await runtime.instance.disconnect();
					runtime.instance = undefined;
					runtime.status = KafkaServiceStatus.STOPPED;
					runtime.startedAt = undefined;
					runtime.error = undefined;
				}
			} catch (error) {
				this.logger.error(`Error stopping service ${runtime.id}`, {
					id: runtime.id,
					type: runtime.type,
					topic: runtime.topic,
					error: error instanceof Error ? error.message : String(error),
				});
				runtime.status = KafkaServiceStatus.ERROR;
				runtime.error = error instanceof Error ? error.message : String(error);
			}
		});

		await Promise.allSettled(stopPromises);

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
}


