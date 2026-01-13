import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Kafka, KafkaConfig, SASLOptions } from 'kafkajs';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Kafka Client Service
 * 
 * Provides a singleton Kafka client instance configured with SASL authentication.
 * The client is shared between consumers and producers.
 */
@Injectable()
export class KafkaClientService implements OnModuleDestroy {
	private readonly kafka: Kafka;
	private readonly logger: LoggerService;

	constructor(
		configService: ConfigService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('KafkaClientService');

		const config = configService.getAll();
		
		// Diagnostic: Log the actual KAFKA_SSL value being used
		console.log('[KafkaClientService] KAFKA_SSL value:', config.KAFKA_SSL, 'type:', typeof config.KAFKA_SSL, 'raw env:', process.env.KAFKA_SSL);
		
		// Build SASL configuration - only include when SSL is enabled
		// Plaintext connections (port 9092) don't support SASL authentication
		// SASL is only used with SSL/TLS connections
		const sasl: SASLOptions | undefined = config.KAFKA_SSL === true && config.KAFKA_SASL_MECHANISM && config.KAFKA_SASL_USERNAME && config.KAFKA_SASL_PASSWORD
			? {
					mechanism: config.KAFKA_SASL_MECHANISM,
					username: config.KAFKA_SASL_USERNAME,
					password: config.KAFKA_SASL_PASSWORD,
				}
			: undefined;

		// Build Kafka config
		// Explicitly set ssl: false when KAFKA_SSL is false to prevent KafkaJS from defaulting to SSL
		const kafkaConfig: KafkaConfig = {
			clientId: config.KAFKA_CLIENT_ID,
			brokers: config.KAFKA_BROKERS.split(',').map(b => b.trim()),
			ssl: config.KAFKA_SSL === true,
			...(sasl && { sasl }),
		};

		this.logger.info('Creating Kafka client', {
			clientId: kafkaConfig.clientId,
			brokers: kafkaConfig.brokers,
			ssl: kafkaConfig.ssl,
			saslEnabled: !!sasl,
		});

		this.kafka = new Kafka(kafkaConfig);
	}

	/**
	 * Get the Kafka client instance
	 */
	getClient(): Kafka {
		return this.kafka;
	}

	async onModuleDestroy() {
		this.logger.info('Kafka client service destroyed');
	}
}


