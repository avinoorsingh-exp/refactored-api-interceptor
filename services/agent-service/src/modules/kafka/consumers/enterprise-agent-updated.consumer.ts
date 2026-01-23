import { Injectable } from '@nestjs/common';
import { Consumer, KafkaMessage } from 'kafkajs';
import { KafkaClientService } from '../kafka-client.service.js';
import { KafkaMessageProcessingService } from '../kafka-message-processing.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { RegisterableKafkaService } from '../kafka-runtime-manager.service.js';

/**
 * Enterprise Agent Updated Consumer
 * 
 * Consumes messages from the Enterprise_AgentUpdated_V2 topic.
 * This is a proof of concept consumer that processes one message at a time.
 * 
 * Implements RegisterableKafkaService to be managed by KafkaRuntimeManager.
 * Lifecycle is controlled by the runtime manager, not NestJS lifecycle hooks.
 */
@Injectable()
export class EnterpriseAgentUpdatedConsumer implements RegisterableKafkaService {
	private readonly topic = 'Enterprise_AgentUpdated_V2';
	private readonly groupId: string;
	private consumer: Consumer | null = null;
	private readonly logger: LoggerService;
	private readonly maxRetries = 3;
	private readonly retryDelayMs = 1000; // Initial delay: 1 second
	private readonly serviceId: string;

	constructor(
		private readonly kafkaClientService: KafkaClientService,
		private readonly configService: ConfigService,
		private readonly kafkaMessageProcessingService: KafkaMessageProcessingService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('EnterpriseAgentUpdatedConsumer');
		this.groupId = this.configService.get('KAFKA_CONSUMER_GROUP_ID');
		// Generate a unique service ID based on topic and groupId
		this.serviceId = `consumer-${this.topic}-${this.groupId}`;
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
		return 'consumer';
	}

	/**
	 * Get Kafka topic name.
	 */
	getTopic(): string {
		return this.topic;
	}

	/**
	 * Get consumer group ID.
	 */
	getGroupId(): string | undefined {
		return this.groupId;
	}

	/**
	 * Start the consumer and begin processing messages.
	 * Returns the Consumer instance for runtime tracking.
	 */
	async start(): Promise<Consumer> {
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

			// consumer.run() returns a promise that resolves when the consumer starts
			// but continues running in the background. If it rejects later (e.g., on crash),
			// we need to handle that rejection to prevent unhandled promise rejections
			this.consumer.run({
				eachMessage: async ({ topic, partition, message }) => {
					await this.handleMessage(topic, partition, message);
				},
			}).catch((error) => {
				// Handle consumer run errors (crashes, disconnections, etc.)
				this.logger.error('Kafka consumer run() promise rejected', {
					error: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined,
				});
				// Don't rethrow - the consumer is already stopped/crashed
				// This prevents unhandled promise rejections that could cause module destruction
			});

			this.logger.info('Enterprise Agent Updated consumer started successfully');
			
			// Return the consumer instance for runtime tracking
			if (!this.consumer) {
				throw new Error('Consumer instance is null after start');
			}
			return this.consumer;
		} catch (error) {
			this.logger.error('Failed to start Kafka consumer', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			// Re-throw to let runtime manager handle the error state
			throw error;
		}
	}

	/**
	 * Stop the consumer gracefully.
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
				
				// Log raw and parsed message for debugging
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

			// Translate the message before storing it
			// This ensures the database stores the translated format, not the raw message
			let translatedPayload: Record<string, unknown>;
			try {
				const translated = this.translateKafkaMessageToUpsertData(parsedMessage as any);
				// Convert the translated object to a plain object for JSON storage
				translatedPayload = translated as unknown as Record<string, unknown>;
			} catch (translationError) {
				// If translation fails, log error but store raw message
				// This allows tracking even if translation has issues
				this.logger.warn('Failed to translate message before storing - storing raw message', {
					topic,
					partition,
					offset: message.offset,
					error: translationError instanceof Error ? translationError.message : 'Unknown error',
				});
				translatedPayload = parsedMessage as Record<string, unknown>;
			}

			// On message receive: Lookup SENT record and increment attempt_count
			// Record should already exist from producer with SENT status
			// This ensures we track every message attempt, even if processing fails
			const allConfig = this.configService.getAll();
			const serviceName = String((allConfig as Record<string, unknown>)['SERVICE_NAME'] || 'agent-service');
			await this.kafkaMessageProcessingService.lookupOrUpdateSentAndIncrementAttempt({
				topic,
				partition,
				offset: message.offset,
				messageKey: messageKey || undefined,
				eventId: (parsedMessage as any)?.eventId || (parsedMessage as any)?.uuid || undefined,
				payload: translatedPayload,
				headers: message.headers ? Object.fromEntries(
					Object.entries(message.headers).map(([k, v]) => [k, v?.toString() || ''])
				) : undefined,
				consumerGroup: this.groupId,
				serviceName,
			});

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
				
				// After successful processing: Update status = PROCESSED, processed_at = now(), updated_at = now()
				await this.kafkaMessageProcessingService.markAsProcessed(
					topic,
					partition,
					offset,
				);

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
				
				// Mark as error in database (non-blocking)
				await this.kafkaMessageProcessingService.markAsError(
					topic,
					partition,
					offset,
					error instanceof Error ? error : new Error(String(error)),
					!isLastAttempt, // Retryable if not last attempt
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
		try {
		// Translate Kafka message to database format
		const translated = this.translateKafkaMessageToUpsertData(message as any);
		
		// Log the translated result for verification
		// Pass the object directly - logger will handle JSON serialization properly
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
	 * Maps address label to type and role based on common patterns in the database.
	 * 
	 * Based on analysis of core.address table in test environment:
	 * - Most addresses are 'personal' type unless explicitly business/company related
	 * - Role is determined by the label's purpose (billing, shipping, contact, etc.)
	 * 
	 * Common label patterns observed:
	 * - "Contactinfo", "Buyer Address", "Seller Address", "Home address" → type: 'personal', role: 'contact'
	 * - "Billing Address", "BillTo", "Bill To" → type: 'personal', role: 'bill_to'
	 * - "W9", "w9", "W9 address", "1099" → type: 'personal', role: 'pay_to'
	 * - "Mailing address", "Mailing Address", "Shipping address" → type: 'personal', role: 'ship_to'
	 * - "Office", "Business", "Company" → type: 'company', role: 'contact'
	 * - "Title Address", "Lender Address", "Attorney Address", "Escrow Address" → type: 'company', role: 'contact'
	 * 
	 * @param label - Address label from Kafka payload (e.g., "Contactinfo", "Billing Address", "W9")
	 * @returns Object with type ('personal' | 'company') and role ('contact' | 'bill_to' | 'pay_to' | 'ship_to' | 'return_to')
	 */
	private mapAddressLabelToTypeAndRole(label?: string): {
		type?: 'personal' | 'company';
		role?: 'contact' | 'bill_to' | 'pay_to' | 'ship_to' | 'return_to';
	} {
		if (!label) {
			return { type: 'personal', role: 'contact' };
		}
		const normalizedLabel = label.trim().toLowerCase();
		// Determine type (personal vs company)
		// Company type indicators: business, company, office, MLS, title, lender, attorney, escrow, transaction, miscellaneous
		const isCompanyType = normalizedLabel.includes('business') ||
			normalizedLabel.includes('company') ||
			normalizedLabel.includes('office') ||
			normalizedLabel.includes('mls') ||
			normalizedLabel.includes('title') ||
			normalizedLabel.includes('lender') ||
			normalizedLabel.includes('attorney') ||
			normalizedLabel.includes('escrow') ||
			normalizedLabel.includes('home warranty') ||
			normalizedLabel.includes('transaction') ||
			normalizedLabel.includes('miscellaneous') ||
			normalizedLabel.includes('agent representing');
		const type: 'personal' | 'company' = isCompanyType ? 'company' : 'personal';
		// Determine role based on label patterns (order matters - check more specific patterns first)
		let role: 'contact' | 'bill_to' | 'pay_to' | 'ship_to' | 'return_to' | undefined;
		if (normalizedLabel === 'billto' || normalizedLabel === 'bill to' || normalizedLabel.startsWith('bill')) {
			role = 'bill_to';
		} else if (normalizedLabel.includes('w9') || normalizedLabel.includes('1099') || normalizedLabel.includes('pay')) {
			role = 'pay_to';
		} else if (normalizedLabel.includes('return')) {
			role = 'return_to';
		} else if (normalizedLabel.includes('ship') || normalizedLabel.includes('mail')) {
			role = 'ship_to';
		} else if (
			normalizedLabel.includes('contact') ||
			normalizedLabel.includes('buyer') ||
			normalizedLabel.includes('seller') ||
			normalizedLabel.includes('home') ||
			normalizedLabel === 'contactinfo' ||
			normalizedLabel === 'contact info'
		) {
			role = 'contact';
		} else {
			// Default to 'contact' for unknown labels (most common pattern in database)
			role = 'contact';
		}
		return { type, role };
	}

	/**
	 * Translate Enterprise_AgentUpdated_V2 Kafka message to database upsert format
	 */
	private translateKafkaMessageToUpsertData(payload: any): {
		agent: {
			id?: string;
			agentId?: string;
			systemId?: number;
			firstName: string;
			middleName?: string;
			lastName: string;
			suffix?: string;
			preferredName?: string;
			title?: 'Mr' | 'Mrs' | 'Ms' | 'Miss';
			birthDate?: Date;
			lifecycleStatus: string;
			joinDate?: Date;
			anniversaryDate?: Date;
			terminationDate?: Date;
			isStaff: boolean;
			agentCompanyId?: string;
		};
		contactMethods: Array<{
			name: string;
			channel: 'email' | 'phone';
			value: string;
			isPrimary: boolean;
			subType?: 'mobile' | 'home' | 'work' | 'fax' | 'personal';
			smsOptIn?: boolean;
		}>;
		addresses: Array<{
			line1: string;
			line2?: string;
			city: string;
			postalCode: string;
			unit?: string;
			county?: string;
			label?: string;
			type?: 'personal' | 'company';
			role?: 'contact' | 'bill_to' | 'pay_to' | 'ship_to' | 'return_to';
			isPrimary: boolean;
			stateCode?: string;
			countryAlpha2?: string;
		}>;
		offices: Array<{
			officeId?: string;
			officeName: string;
			isPrimary: boolean;
			companyId?: string;
			lifecycleStatus?: string;
			phone?: string;
			website?: string;
			primaryState?: string;
		}>;
		mls: Array<{
			mlsId?: string;
			name: string;
			ouid?: string;
			globalId?: number;
			shortName?: string;
			orgType: string;
			lifecycleStatus: string;
		}>;
	} {
		// Translate agent core fields
		const agent = {
			id: payload.uuid || undefined,
			agentId: payload.source_system_member_key?.toString() || undefined,
			systemId: payload.systemkey || undefined,
			firstName: payload.member_first_name || '',
			middleName: payload.member_middle_name || undefined,
			lastName: payload.member_last_name || '',
			suffix: payload.suffix || undefined,
			preferredName: payload.preferred_name || undefined,
			title: payload.title as 'Mr' | 'Mrs' | 'Ms' | 'Miss' | undefined,
			birthDate: payload.Birthday ? new Date(payload.Birthday) : undefined,
			lifecycleStatus: this.mapLifecycleStatus(payload.lifecycle_status_caption || payload.lifecycle_status_key || 'Joining'),
			joinDate: payload.join_date ? new Date(payload.join_date) : undefined,
			anniversaryDate: payload.anniversary_date ? new Date(payload.anniversary_date) : undefined,
			terminationDate: payload.termination_date ? new Date(payload.termination_date) : undefined,
			isStaff: false, // Default or map from payload if available
			agentCompanyId: payload.AgentCompany?.AgentCompanyID?.toString() || undefined,
		};

		// Translate contact methods
		const contactMethods: Array<{
			name: string;
			channel: 'email' | 'phone';
			value: string;
			isPrimary: boolean;
			subType?: 'mobile' | 'home' | 'work' | 'fax' | 'personal';
			smsOptIn?: boolean;
		}> = [];

		// Primary Email: name = Primary Email, is_primary = true, channel = email, sub_type = work, sms_opt_in = false
		if (payload.member_email) {
			contactMethods.push({
				name: 'Primary Email',
				channel: 'email',
				value: payload.member_email,
				isPrimary: true,
				subType: 'work',
				smsOptIn: false,
			});
		}

		// Secondary Email: name = Secondary Email, is_primary = false, channel = email, sub_type = personal, sms_opt_in = false
		if (payload.secondary_email) {
			contactMethods.push({
				name: 'Secondary Email',
				channel: 'email',
				value: payload.secondary_email,
				isPrimary: false,
				subType: 'personal',
				smsOptIn: false,
			});
		}

		// Mobile Phone: name = Mobile Phone, is_primary = true, channel = phone, sub_type = mobile, sms_opt_in = RecieveText (from payload)
		if (payload.cell_phone || payload.member_mobile_phone) {
			contactMethods.push({
				name: 'Mobile Phone',
				channel: 'phone',
				value: payload.cell_phone || payload.member_mobile_phone,
				isPrimary: true,
				subType: 'mobile',
				smsOptIn: payload.ReceiveText === true,
			});
		}

		// Fax Number: name = Fax Number, is_primary = false, channel = phone, sub_type = fax, sms_opt_in = false
		if (payload.fax) {
			contactMethods.push({
				name: 'Fax Number',
				channel: 'phone',
				value: payload.fax,
				isPrimary: false,
				subType: 'fax',
				smsOptIn: false,
			});
		}

		// Translate addresses
		const addresses: Array<{
			line1: string;
			line2?: string;
			city: string;
			postalCode: string;
			unit?: string;
			county?: string;
			label?: string;
			type?: 'personal' | 'company';
			role?: 'contact' | 'bill_to' | 'pay_to' | 'ship_to' | 'return_to';
			isPrimary: boolean;
			stateCode?: string;
			countryAlpha2?: string;
		}> = [];

		if (Array.isArray(payload.addresses)) {
			for (const addr of payload.addresses) {
				// Support both address_line_1 (actual payload) and line_1 (user's mapping description)
				const line1 = addr.address_line_1 || addr.line_1;
				const postalCode = addr.postal_code || addr.zip;
				if (line1 && addr.city && postalCode) {
					const label = addr.label || undefined;
					const { type, role } = this.mapAddressLabelToTypeAndRole(label);
					addresses.push({
						line1: line1,
						line2: addr.address_line_2 || addr.line_2 || undefined,
						city: addr.city,
						postalCode: postalCode,
						unit: addr.unit_number || undefined,
						county: addr.county || undefined,
						label: label,
						type: type,
						role: role,
						isPrimary: addr.is_primary === true || addr.is_primary === 'true',
						stateCode: addr.state?.code || undefined,
						countryAlpha2: addr.country?.iso_3166_1?.alpha_2 || undefined,
					});
				}
			}
		}

		// Translate offices
		const offices: Array<{
			officeId?: string;
			officeName: string;
			isPrimary: boolean;
			companyId?: string;
			lifecycleStatus?: string;
			phone?: string;
			website?: string;
			primaryState?: string;
		}> = [];

		if (Array.isArray(payload.offices)) {
			for (const office of payload.offices) {
				// Support both office_name (actual payload) and name (user's mapping description)
				const officeName = office.office_name || office.name;
				if (officeName) {
					offices.push({
						officeId: office.originating_system_office_key?.toString() || undefined,
						officeName: officeName,
						isPrimary: office.is_primary === true,
						companyId: office.company?.intacct_entity_no?.toString() || undefined,
						lifecycleStatus: office.lifecycle_status || 'active',
						phone: office.phone || undefined,
						website: office.website || undefined,
						primaryState: office.state || undefined,
					});
				}
			}
		}

		// Translate MLS
		const mls: Array<{
			mlsId?: string;
			name: string;
			ouid?: string;
			globalId?: number;
			shortName?: string;
			orgType: string;
			lifecycleStatus: string;
		}> = [];

		// From mlss array (full MLS objects)
		if (Array.isArray(payload.mlss)) {
			for (const mlsItem of payload.mlss) {
				if (mlsItem.name) {
					// Normalize org_type to lowercase to match schema enum
					const orgType = mlsItem.org_type?.toLowerCase() || 'mls';
					mls.push({
						mlsId: mlsItem.mlsid?.toString() || undefined,
						name: mlsItem.name,
						ouid: mlsItem.ouid || undefined,
						globalId: mlsItem.global_id || undefined,
						shortName: mlsItem.shortname || undefined,
						orgType: orgType,
						lifecycleStatus: mlsItem.lifecycle_status || mlsItem.org_status || 'active',
					});
				}
			}
		}

		return {
			agent,
			contactMethods,
			addresses,
			offices,
			mls,
		};
	}

	/**
	 * Map lifecycle status from Kafka payload to database format
	 */
	private mapLifecycleStatus(status: string): string {
		const statusMap: Record<string, string> = {
			'Joining': 'Joining',
			'Active': 'Active',
			'Inactive': 'Inactive',
			'InActive': 'Inactive',
			'Vested': 'Vested',
			'Vested Retired': 'VestedRetired',
			'VestedRetired': 'VestedRetired',
			'Lead Only': 'LeadOnly',
			'LeadOnly': 'LeadOnly',
		};
		return statusMap[status] || 'Joining';
	}
}

