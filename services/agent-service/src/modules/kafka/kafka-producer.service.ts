import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Producer } from 'kafkajs';
import { KafkaClientService } from './kafka-client.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';

/**
 * Kafka Producer Service
 * 
 * Provides functionality to produce messages to Kafka topics.
 * Manages producer lifecycle and connection.
 * 
 * Note: Kafka producer is disabled when NODE_ENV === 'local' to prevent
 * connection attempts in local development environments.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
	private producer: Producer | null = null;
	private readonly logger: LoggerService;

	constructor(
		private readonly kafkaClientService: KafkaClientService,
		private readonly configService: ConfigService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaProducerService');
	}

	async onModuleInit() {
		const nodeEnv = this.configService.get('NODE_ENV');
		
		// Skip Kafka producer initialization in local environment
		if (nodeEnv === 'local') {
			this.logger.info('Kafka producer skipped - NODE_ENV is "local". Kafka integration only runs in AWS environments.');
			return;
		}

		// Attempt to connect, but don't fail startup if connection fails
		try {
			await this.connect();
		} catch (error) {
			this.logger.warn('Kafka producer connection failed during startup - will retry on first use', {
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			// Don't throw - allow service to start without Kafka producer
		}
	}

	async onModuleDestroy() {
		const nodeEnv = this.configService.get('NODE_ENV');
		
		// Skip Kafka producer shutdown in local environment
		if (nodeEnv === 'local') {
			return;
		}

		await this.disconnect();
	}

	/**
	 * Connect the producer to Kafka
	 */
	private async connect(): Promise<void> {
		try {
			const kafka = this.kafkaClientService.getClient();
			this.producer = kafka.producer();

			await this.producer.connect();
			this.logger.info('Kafka producer connected');
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
	 * Disconnect the producer from Kafka
	 */
	private async disconnect(): Promise<void> {
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
		const messageValue = typeof message === 'string' ? message : JSON.stringify(message);

		// Skip sending in local environment, but log the message
		if (nodeEnv === 'local') {
			this.logger.info('Kafka message skipped (local environment) - message would be sent to topic', {
				topic,
				key,
				message: messageValue,
				headers,
			});
			return;
		}

		// Try to connect if not already connected
		if (!this.producer) {
			this.logger.warn('Kafka producer not connected, attempting to connect...');
			try {
				await this.connect();
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
			await this.producer.send({
				topic,
				messages: [
					{
						key: key,
						value: messageValue,
						headers,
					},
				],
			});

			// Log the full message payload for CloudWatch visibility
			// Parse message for better readability in logs (if it's a string, try to parse it)
			// Format matches consumer logging style - pass object directly for proper JSON serialization
			let logMessage: unknown = message;
			if (typeof message === 'string') {
				try {
					logMessage = JSON.parse(messageValue);
				} catch {
					// If parsing fails, use the string as-is
					logMessage = messageValue;
				}
			}

			// Log in same format as consumer: structured object with message payload
			this.logger.info('Kafka message sent to topic', {
				topic,
				key,
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

