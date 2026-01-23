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
		
		// Build Kafka config - match transaction-service approach
		// For plaintext connections, only set clientId and brokers
		// Only add ssl/sasl if explicitly enabled
		const kafkaConfig: KafkaConfig = {
			clientId: config.KAFKA_CLIENT_ID,
			brokers: config.KAFKA_BROKERS.split(',').map(b => b.trim()),
		};
		
		// Only add SSL/SASL if KAFKA_SSL is explicitly true
		// For plaintext connections (port 9092), omit ssl and sasl entirely
		const kafkaSslEnabled = config.KAFKA_SSL || String(config.KAFKA_SSL).toLowerCase() === 'true';
		
		if (kafkaSslEnabled) {
			kafkaConfig.ssl = true;
			
			// SASL is only used with SSL/TLS connections
			if (config.KAFKA_SASL_MECHANISM && config.KAFKA_SASL_USERNAME && config.KAFKA_SASL_PASSWORD) {
				const sasl: SASLOptions = {
					mechanism: config.KAFKA_SASL_MECHANISM,
					username: config.KAFKA_SASL_USERNAME,
					password: config.KAFKA_SASL_PASSWORD,
				};
				kafkaConfig.sasl = sasl;
			}
		}

		this.logger.info('Creating Kafka client', {
			clientId: kafkaConfig.clientId,
			brokers: kafkaConfig.brokers,
			ssl: kafkaConfig.ssl ?? false,
			saslEnabled: !!kafkaConfig.sasl,
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


