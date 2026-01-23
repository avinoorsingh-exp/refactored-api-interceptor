import { Injectable } from '@nestjs/common';
import { Consumer, KafkaMessage } from 'kafkajs';
import { KafkaClientService } from '../kafka-client.service.js';
import { KafkaMessageProcessingService } from '../kafka-message-processing.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { RegisterableKafkaService } from '../kafka-runtime-manager.service.js';

/**
 * Global ADS Agent Updated Consumer
 * 
 * Consumes messages from the Global_ADS_AgentUpdated_V2 topic.
 * 
 * Implements RegisterableKafkaService to be managed by KafkaRuntimeManager.
 * Lifecycle is controlled by the runtime manager, not NestJS lifecycle hooks.
 */
@Injectable()
export class GlobalAdsAgentUpdatedConsumer implements RegisterableKafkaService {
	private readonly topic = 'Global_ADS_AgentUpdated_V2';
	private readonly groupId: string;
	private consumer: Consumer | null = null;
	private readonly logger: LoggerService;
	private readonly maxRetries = 3;
	private readonly retryDelayMs = 1000;
	private readonly serviceId: string;

	constructor(
		private readonly kafkaClientService: KafkaClientService,
		private readonly configService: ConfigService,
		private readonly kafkaMessageProcessingService: KafkaMessageProcessingService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('GlobalAdsAgentUpdatedConsumer');
		this.groupId = this.configService.get('KAFKA_CONSUMER_GROUP_ID');
		this.serviceId = `consumer-${this.topic}-${this.groupId}`;
	}

	getId(): string {
		return this.serviceId;
	}

	getType(): 'consumer' | 'producer' {
		return 'consumer';
	}

	getTopic(): string {
		return this.topic;
	}

	getGroupId(): string | undefined {
		return this.groupId;
	}

	async start(): Promise<Consumer> {
		try {
			const kafka = this.kafkaClientService.getClient();
			// Add sessionTimeout and heartbeatInterval to help with rebalancing
			this.consumer = kafka.consumer({ 
				groupId: this.groupId,
				sessionTimeout: 30000, // 30 seconds
				heartbeatInterval: 3000, // 3 seconds
			});

			// Set up event handlers for logging (KafkaJS handles rebalancing automatically)
			this.consumer.on(this.consumer.events.GROUP_JOIN, (event) => {
				this.logger.info('Consumer joined group', {
					topic: this.topic,
					groupId: this.groupId,
					memberId: event.payload.memberId,
					isLeader: event.payload.isLeader,
				});
			});

			this.consumer.on(this.consumer.events.CRASH, (event) => {
				this.logger.error('Consumer crashed', {
					topic: this.topic,
					error: event.payload.error.message,
				});
			});

			await this.consumer.connect();
			this.logger.info('Kafka consumer connected', {
				topic: this.topic,
				groupId: this.groupId,
			});

			await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
			this.logger.info('Subscribed to topic', { topic: this.topic });

			// CRITICAL: Do NOT call consumer.run() here.
			// The KafkaRuntimeManager will call consumer.run() with a message router
			// that handles multiple topics sharing the same groupId.
			// This ensures only ONE Consumer instance exists per groupId.

			this.logger.info('Global ADS Agent Updated consumer started successfully');
			
			if (!this.consumer) {
				throw new Error('Consumer instance is null after start');
			}
			return this.consumer;
		} catch (error) {
			this.logger.error('Failed to start Kafka consumer', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		}
	}

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
	 * Get message handler for this consumer.
	 * Used by KafkaRuntimeManager to route messages when multiple services share a groupId.
	 * Returns a function matching KafkaJS EachMessageHandler signature.
	 */
	getMessageHandler(): (payload: { topic: string; partition: number; message: KafkaMessage }) => Promise<void> {
		return async (payload: { topic: string; partition: number; message: KafkaMessage }) => {
			await this.handleMessage(payload.topic, payload.partition, payload.message);
		};
	}

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

			let parsedMessage: unknown;
			try {
				parsedMessage = JSON.parse(messageValue);
				this.logger.info('Kafka message parsed successfully', {
					topic,
					partition,
					offset: message.offset,
					rawMessage: messageValue,
					parsedMessage: parsedMessage,
				});
			} catch (parseError) {
				this.logger.warn('Failed to parse message as JSON - skipping retry', {
					topic,
					partition,
					offset: message.offset,
					rawMessage: messageValue,
					error: parseError instanceof Error ? parseError.message : 'Unknown error',
				});
				return;
			}

			let translatedPayload: Record<string, unknown>;
			try {
				const translated = this.translateKafkaMessageToUpsertData(parsedMessage as any);
				translatedPayload = translated as unknown as Record<string, unknown>;
			} catch (translationError) {
				this.logger.warn('Failed to translate message before storing - storing raw message', {
					topic,
					partition,
					offset: message.offset,
					error: translationError instanceof Error ? translationError.message : 'Unknown error',
				});
				translatedPayload = parsedMessage as Record<string, unknown>;
			}

			const allConfig = this.configService.getAll();
			const serviceName = String((allConfig as Record<string, unknown>)['SERVICE_NAME'] || 'agent-service');
			await this.kafkaMessageProcessingService.lookupOrUpdateSentAndIncrementAttempt({
				topic,
				partition,
				offset: message.offset,
				messageKey: messageKey || undefined,
				eventId: (parsedMessage as any)?.eventId || (parsedMessage as any)?.Uuid || (parsedMessage as any)?.uuid || undefined,
				payload: translatedPayload,
				headers: message.headers ? Object.fromEntries(
					Object.entries(message.headers).map(([k, v]) => [k, v?.toString() || ''])
				) : undefined,
				consumerGroup: this.groupId,
				serviceName,
			});

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
		}
	}

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
				
				await this.kafkaMessageProcessingService.markAsProcessed(
					topic,
					partition,
					offset,
				);

				if (attempt > 1) {
					this.logger.info('Message processed successfully after retry', {
						topic,
						partition,
						offset,
						attempt,
						totalAttempts: attempt,
					});
				}
				return;
			} catch (error) {
				lastError = error;
				const isLastAttempt = attempt === this.maxRetries;
				
				await this.kafkaMessageProcessingService.markAsError(
					topic,
					partition,
					offset,
					error instanceof Error ? error : new Error(String(error)),
					!isLastAttempt,
				);
				
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
					throw error;
				} else {
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
					
					await this.sleep(delayMs);
				}
			}
		}
		
		throw lastError || new Error('Message processing failed');
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Process agent update message
	 * 
	 * Placeholder implementation - translation logic to be added later.
	 */
	private async processAgentUpdate(message: unknown): Promise<void> {
		try {
			const translated = this.translateKafkaMessageToUpsertData(message as any);
			this.logger.info('Translated Kafka message to upsert format', {
				translated: translated,
			});
		} catch (error) {
			this.logger.error('Error translating Kafka message', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		}
	}

	/**
	 * Translate Global_ADS_AgentUpdated_V2 Kafka message to database upsert format
	 */
	private translateKafkaMessageToUpsertData(payload: any): {
		agent: {
			id?: string;
			agentId?: string;
			systemId?: number;
			isStaff: boolean;
			joinDate?: Date;
			lastName: string;
			firstName: string;
			middleName?: string;
			preferredName?: string;
			anniversaryDate?: Date;
			lifecycleStatus: string;
		};
		addresses: Array<{
			city: string;
			role: 'contact';
			type: 'personal' | 'company';
			label: string;
			line1: string;
			line2?: string;
			isPrimary: boolean;
			countryAlpha2?: string;
			postalCode: string;
		}>;
		contactMethods: Array<{
			name: string;
			channel: 'email' | 'phone';
			value: string;
			isPrimary: boolean;
			subType?: 'mobile' | 'home' | 'work' | 'fax' | 'personal';
			smsOptIn?: boolean;
		}>;
	} {
		// Translate agent core fields
		const agent = {
			id: payload.Uuid || undefined,
			agentId: payload.SourceSystemKey?.toString() || undefined,
			systemId: payload.SourceSystemId || undefined,
			isStaff: false,
			joinDate: payload.JoinDate ? new Date(payload.JoinDate) : undefined,
			lastName: payload.LastName || '',
			firstName: payload.FirstName || '',
			middleName: payload.MiddleName || undefined,
			preferredName: payload.PreferredName || undefined,
			anniversaryDate: payload.AnniversaryDate ? new Date(payload.AnniversaryDate) : undefined,
			lifecycleStatus: payload.Status || 'Active',
		};

		// Translate addresses
		// Note: Global_ADS uses "Addresses" (not "Addresss" like AU/UK)
		// Only include addresses that have required fields (Line1, Town, Postcode)
		const addresses: Array<{
			city: string;
			role: 'contact';
			type: 'personal' | 'company';
			label: string;
			line1: string;
			line2?: string;
			isPrimary: boolean;
			countryAlpha2?: string;
			postalCode: string;
		}> = [];

		if (Array.isArray(payload.Addresses)) {
			for (const addr of payload.Addresses) {
				// Require Line1 and Postcode for valid address
				// If Town is missing, use 'UNKNOWN' for city
				if (addr.Line1 && addr.Postcode) {
					const addressType = addr.AddressType || '';
					const isPersonal = addressType.toLowerCase() === 'personal';
					const type: 'personal' | 'company' = isPersonal ? 'personal' : 'company';
					const label = isPersonal ? 'Personal Address' : 'Business Address';

					addresses.push({
						city: addr.Town || 'UNKNOWN',
						role: 'contact',
						type: type,
						label: label,
						line1: addr.Line1,
						line2: addr.Line2 || undefined,
						isPrimary: false,
						countryAlpha2: addr.Country || undefined,
						postalCode: addr.Postcode,
					});
				}
			}
		}

		// Translate contact methods
		const contactMethods: Array<{
			name: string;
			channel: 'email' | 'phone';
			value: string;
			isPrimary: boolean;
			subType?: 'mobile' | 'home' | 'work' | 'fax' | 'personal';
			smsOptIn?: boolean;
		}> = [];

		// Translate phones
		if (Array.isArray(payload.Phones)) {
			for (const phone of payload.Phones) {
				if (phone.Number) {
					const phoneType = phone.PhoneType || '';
					const phoneTypeLower = phoneType.toLowerCase();

					let name: string;
					let subType: 'mobile' | 'home' | 'work';
					let isPrimary: boolean;

					if (phoneTypeLower === 'cell') {
						name = 'Mobile Phone';
						subType = 'mobile';
						isPrimary = true;
					} else if (phoneTypeLower === 'whatsapp') {
						name = 'Whats App';
						subType = 'mobile';
						isPrimary = false;
					} else if (phoneTypeLower === 'home') {
						name = 'Home Phone';
						subType = 'home';
						isPrimary = false;
					} else if (phoneTypeLower === 'office') {
						name = 'Office Phone';
						subType = 'work';
						isPrimary = false;
					} else {
						// Default for unknown phone types
						name = phoneType || 'Phone';
						subType = 'mobile';
						isPrimary = false;
					}

					contactMethods.push({
						name: name,
						channel: 'phone',
						value: phone.Number,
						isPrimary: isPrimary,
						subType: subType,
						smsOptIn: false,
					});
				}
			}
		}

		// Work Email: name = "Work Email", value = ExpEmail, channel = email, subType = work, isPrimary = true
		if (payload.ExpEmail) {
			contactMethods.push({
				name: 'Work Email',
				channel: 'email',
				value: payload.ExpEmail,
				isPrimary: true,
				subType: 'work',
				smsOptIn: false,
			});
		}

		// Personal Email: name = "Personal Email", value = Email, channel = email, subType = personal, isPrimary = false
		if (payload.Email) {
			contactMethods.push({
				name: 'Personal Email',
				channel: 'email',
				value: payload.Email,
				isPrimary: false,
				subType: 'personal',
				smsOptIn: false,
			});
		}

		return {
			agent,
			addresses,
			contactMethods,
		};
	}
}

