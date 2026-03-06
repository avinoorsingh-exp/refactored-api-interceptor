import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Producer } from 'kafkajs';
import { KafkaClientService } from './kafka-client.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { RegisterableKafkaService } from './kafka-runtime-manager.service.js';

/**
 * Kafka Producer Service
 * 
 * Provides functionality to produce messages to Kafka topics.
 * Manages producer lifecycle and connection.
 * 
 * Implements RegisterableKafkaService to be managed by KafkaRuntimeManager.
 * Lifecycle is controlled by the runtime manager, not NestJS lifecycle hooks.
 */
@Injectable()
export class KafkaProducerService implements RegisterableKafkaService {
	private producer: Producer | null = null;
	private readonly logger: LoggerService;
	private readonly serviceId: string;

	constructor(
		private readonly kafkaClientService: KafkaClientService,
		private readonly configService: ConfigService,
		loggerService: LoggerService,
		@Inject(forwardRef(() => KafkaMessageProcessingService))
		private readonly kafkaMessageProcessingService: KafkaMessageProcessingService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaProducerService');
		// Generate a unique service ID for the producer
		// Producer doesn't have a specific topic, so we use a generic ID
		this.serviceId = 'producer-global';
	}

	/**
	 * Get unique identifier for this service.
	 */
	getId(): string {
		return this.serviceId;
	}

	/**
	 * Get service type.
	 */
	getType(): 'consumer' | 'producer' {
		return 'producer';
	}

	/**
	 * Get Kafka topic name.
	 * Producer can send to multiple topics, so we return a generic value.
	 */
	getTopic(): string {
		return 'global'; // Producer is not topic-specific
	}

	/**
	 * Get consumer group ID (not applicable for producers).
	 */
	getGroupId(): string | undefined {
		return undefined;
	}

	/**
	 * Start the producer and connect to Kafka.
	 * Returns the Producer instance for runtime tracking.
	 */
	async start(): Promise<Producer> {
		try {
			const kafka = this.kafkaClientService.getClient();
			this.producer = kafka.producer();

			await this.producer.connect();
			this.logger.info('Kafka producer connected');
			
			if (!this.producer) {
				throw new Error('Producer instance is null after start');
			}
			return this.producer;
		} catch (error) {
			this.logger.error('Failed to connect Kafka producer', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			this.producer = null;
			throw error;
		}
	}

	/**
	 * Stop the producer and disconnect from Kafka.
	 */
	async stop(): Promise<void> {
		if (this.producer) {
			try {
				await this.producer.disconnect();
				this.logger.info('Kafka producer disconnected');
			} catch (error) {
				this.logger.error('Error disconnecting Kafka producer', {
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
			this.producer = null;
		}
	}

	/**
	 * Send a message to the Global_SMS_SponsorChanged_V2 topic
	 * 
	 * @param message - The message payload (will be JSON stringified)
	 * @param key - Optional message key for partitioning
	 * @param headers - Optional message headers
	 */
	async sendSponsorChangedMessage(
		message: unknown,
		key?: string,
		headers?: Record<string, string>,
	): Promise<void> {
		await this.sendMessage('Global_SMS_SponsorChanged_V2', message, key, headers);
	}

	/**
	 * Send a message to a Kafka topic
	 * 
	 * @param topic - The topic name
	 * @param message - The message payload (will be JSON stringified)
	 * @param key - Optional message key for partitioning
	 * @param headers - Optional message headers
	 */
	async sendMessage(
		topic: string,
		message: unknown,
		key?: string,
		headers?: Record<string, string>,
	): Promise<void> {
		const nodeEnv = this.configService.get('NODE_ENV');
		// Convert message to Buffer containing JSON bytes (not stringified)
		// This matches how consumers expect to receive messages: Buffer -> toString() -> JSON.parse()
		const messageValue = typeof message === 'string' 
			? Buffer.from(message) 
			: Buffer.from(JSON.stringify(message));

		// Skip sending in local environment; do not create a SENT record (only store when producer actually sends)
		if (nodeEnv === 'local') {
			this.logger.info('Kafka message skipped (local environment) - message would be sent to topic', {
				topic,
				key,
				message: typeof message === 'object' && message !== null ? message : messageValue.toString(),
				headers,
			});
			return;
		}

		// Try to connect if not already connected
		if (!this.producer) {
			this.logger.warn('Kafka producer not connected, attempting to connect...');
			try {
				await this.start();
			} catch (error) {
				const errorMessage = 'Kafka producer is not available. Cannot send message.';
				this.logger.error(errorMessage, {
					topic,
					key,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				throw new Error(`${errorMessage} Original error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		try {
			// Build KafkaJS message object - only include key if provided
			// Use kafkaMessage variable to avoid shadowing the original message parameter
			// Value is a Buffer containing JSON bytes (not stringified)
			const kafkaMessage: { value: Buffer; key?: string; headers?: Record<string, string> } = {
				value: messageValue,
			};
			
			// Only include key if it's provided and not empty
			if (key !== undefined && key !== null && key !== '') {
				kafkaMessage.key = key;
			}
			
			// Only include headers if provided
			if (headers) {
				kafkaMessage.headers = headers;
			}
			
			const result = await this.producer.send({
				topic,
				messages: [kafkaMessage],
			});

			// Extract partition and offset from the send result
			// result is an array of RecordMetadata arrays (one per topic partition)
			// For a single message, we get the first partition's metadata
			const recordMetadata = result[0]?.[0];
			const partition = recordMetadata?.partition ?? 0;
			const offset = recordMetadata?.offset?.toString() ?? '0';

			// Log if metadata extraction failed (for debugging)
			if (!recordMetadata || recordMetadata.partition === undefined || recordMetadata.offset === undefined) {
				this.logger.warn('Kafka send result metadata incomplete - using defaults', {
					topic,
					key,
					resultStructure: JSON.stringify(result),
					recordMetadata: recordMetadata ? JSON.stringify(recordMetadata) : 'undefined',
					usingPartition: partition,
					usingOffset: offset,
				});
			}

			// Create SENT record in database (non-blocking)
			// Extract eventId from original message payload (not KafkaJS message object)
			let eventId: string | undefined;
			if (typeof message === 'object' && message !== null) {
				const msg = message as Record<string, unknown>;
				eventId = (msg.eventId as string) || (msg.uuid as string) || undefined;
			}

			const allConfig = this.configService.getAll();
			const serviceName = String((allConfig as Record<string, unknown>)['SERVICE_NAME'] || 'agent-service');

			// Create SENT record - this is non-blocking, errors are logged but not thrown
			// Store the original message payload, not the KafkaJS message object (which may have Buffer values)
			const recordCreated = await this.kafkaMessageProcessingService.createSentRecord({
				topic,
				partition,
				offset,
				messageKey: key,
				eventId,
				payload: typeof message === 'object' && message !== null ? message as Record<string, unknown> : { value: messageValue },
				headers,
				serviceName,
			});

			if (!recordCreated) {
				this.logger.warn('Failed to create SENT record in database - check logs for details', {
					topic,
					partition,
					offset,
					messageKey: key,
					eventId,
				});
			}

			// Log the full message payload for CloudWatch visibility
			// Format matches consumer logging style - pass object directly for proper JSON serialization
			// messageValue is a Buffer, so parse it to get the original message object
			let logMessage: unknown = message;
			if (typeof message === 'object' && message !== null) {
				// Use original message object directly
				logMessage = message;
			} else {
				// For non-object messages, parse from Buffer
				try {
					logMessage = JSON.parse(messageValue.toString());
				} catch {
					// If parsing fails, use the string as-is
					logMessage = messageValue.toString();
				}
			}

			// Log in same format as consumer: structured object with message payload
			this.logger.info('Kafka message sent to topic', {
				topic,
				key,
				partition,
				offset,
				message: logMessage, // Pass object directly - logger will handle JSON serialization properly
				headers,
			});
		} catch (error) {
			this.logger.error('Failed to send message to Kafka', {
				topic,
				key,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			// Mark producer as disconnected on send failure
			this.producer = null;
			throw error;
		}
	}

	/**
	 * Check if the producer is connected
	 */
	isConnected(): boolean {
		return this.producer !== null;
	}
}

