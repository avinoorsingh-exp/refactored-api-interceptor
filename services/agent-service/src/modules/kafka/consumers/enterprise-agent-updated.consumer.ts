import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Consumer, KafkaMessage } from 'kafkajs';
import { KafkaClientService } from '../kafka-client.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Enterprise Agent Updated Consumer
 * 
 * Consumes messages from the Enterprise_AgentUpdated_V2 topic.
 * This is a proof of concept consumer that processes one message at a time.
 */
@Injectable()
export class EnterpriseAgentUpdatedConsumer implements OnModuleInit, OnModuleDestroy {
	private readonly topic = 'Enterprise_AgentUpdated_V2';
	private readonly groupId: string;
	private consumer: Consumer | null = null;
	private readonly logger: LoggerService;
	private readonly maxRetries = 3;
	private readonly retryDelayMs = 1000; // Initial delay: 1 second

	constructor(
		private readonly kafkaClientService: KafkaClientService,
		private readonly configService: ConfigService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('EnterpriseAgentUpdatedConsumer');
		this.groupId = this.configService.get('KAFKA_CONSUMER_GROUP_ID');
	}

	async onModuleInit() {
		await this.start();
	}

	async onModuleDestroy() {
		await this.stop();
	}

	/**
	 * Start the consumer and begin processing messages
	 */
	async start(): Promise<void> {
		try {
			const kafka = this.kafkaClientService.getClient();
			this.consumer = kafka.consumer({ groupId: this.groupId });

			await this.consumer.connect();
			this.logger.info('Kafka consumer connected', {
				topic: this.topic,
				groupId: this.groupId,
			});

			await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
			this.logger.info('Subscribed to topic', { topic: this.topic });

			await this.consumer.run({
				eachMessage: async ({ topic, partition, message }) => {
					await this.handleMessage(topic, partition, message);
				},
			});

			this.logger.info('Enterprise Agent Updated consumer started successfully');
		} catch (error) {
			this.logger.error('Failed to start Kafka consumer', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			this.logger.warn('Consumer will not process messages until Kafka is available');
			// Don't throw - allow service to start without consumer
			// The error will be logged and handled gracefully by KafkaModule
			throw error;
		}
	}

	/**
	 * Stop the consumer gracefully
	 */
	async stop(): Promise<void> {
		if (this.consumer) {
			try {
				await this.consumer.disconnect();
				this.logger.info('Kafka consumer disconnected');
			} catch (error) {
				this.logger.error('Error disconnecting Kafka consumer', {
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
			this.consumer = null;
		}
	}

	/**
	 * Handle incoming Kafka message
	 */
	private async handleMessage(
		topic: string,
		partition: number,
		message: KafkaMessage,
	): Promise<void> {
		try {
			const messageValue = message.value?.toString() || '';
			const messageKey = message.key?.toString() || '';

			this.logger.info('Received message', {
				topic,
				partition,
				offset: message.offset,
				key: messageKey,
				timestamp: message.timestamp,
			});

			// Parse message as JSON
			let parsedMessage: unknown;
			try {
				parsedMessage = JSON.parse(messageValue);
			} catch (parseError) {
				this.logger.warn('Failed to parse message as JSON - skipping retry', {
					topic,
					partition,
					offset: message.offset,
					error: parseError instanceof Error ? parseError.message : 'Unknown error',
				});
				return;
			}

			// Process the message with retry logic
			await this.processMessageWithRetry(parsedMessage, topic, partition, message.offset);

			this.logger.info('Message processed successfully', {
				topic,
				partition,
				offset: message.offset,
			});
		} catch (error) {
			this.logger.error('Error handling message - all retries exhausted', {
				topic,
				partition,
				offset: message.offset,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			// After all retries are exhausted, the message will be committed
			// In a production system, you might want to send to a dead letter queue
		}
	}

	/**
	 * Process message with retry logic
	 * 
	 * Retries up to maxRetries times with exponential backoff.
	 */
	private async processMessageWithRetry(
		message: unknown,
		topic: string,
		partition: number,
		offset: string,
	): Promise<void> {
		let lastError: Error | unknown;
		
		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				await this.processAgentUpdate(message);
				// Success - log if it was a retry
				if (attempt > 1) {
					this.logger.info('Message processed successfully after retry', {
						topic,
						partition,
						offset,
						attempt,
						totalAttempts: attempt,
					});
				}
				return; // Success - exit retry loop
			} catch (error) {
				lastError = error;
				const isLastAttempt = attempt === this.maxRetries;
				
				if (isLastAttempt) {
					this.logger.error('Message processing failed after all retries', {
						topic,
						partition,
						offset,
						attempt,
						maxRetries: this.maxRetries,
						error: error instanceof Error ? error.message : 'Unknown error',
						stack: error instanceof Error ? error.stack : undefined,
					});
					// Re-throw on final attempt
					throw error;
				} else {
					// Calculate exponential backoff delay: 1s, 2s, 4s
					const delayMs = this.retryDelayMs * Math.pow(2, attempt - 1);
					
					this.logger.warn('Message processing failed, retrying', {
						topic,
						partition,
						offset,
						attempt,
						maxRetries: this.maxRetries,
						nextRetryInMs: delayMs,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
					
					// Wait before retrying
					await this.sleep(delayMs);
				}
			}
		}
		
		// This should never be reached, but TypeScript needs it
		throw lastError || new Error('Message processing failed');
	}

	/**
	 * Sleep utility for retry delays
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Process agent update message
	 * 
	 * This is a placeholder implementation for proof of concept.
	 * Replace this with your actual business logic.
	 */
	private async processAgentUpdate(message: unknown): Promise<void> {
		this.logger.info('Processing agent update', { message });
		// TODO: Implement your business logic here
		// Example: Update agent in database, trigger notifications, etc.
	}
}

