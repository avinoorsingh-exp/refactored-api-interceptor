import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Producer } from 'kafkajs';
import { KafkaClientService } from './kafka-client.service.js';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Kafka Producer Service
 * 
 * Provides functionality to produce messages to Kafka topics.
 * Manages producer lifecycle and connection.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
	private producer: Producer | null = null;
	private readonly logger: LoggerService;

	constructor(
		private readonly kafkaClientService: KafkaClientService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaProducerService');
	}

	async onModuleInit() {
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
			const messageValue = typeof message === 'string' ? message : JSON.stringify(message);

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

			this.logger.info('Message sent to Kafka topic', {
				topic,
				key,
				hasHeaders: !!headers,
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

