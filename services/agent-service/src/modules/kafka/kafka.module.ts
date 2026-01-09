import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { EnterpriseAgentUpdatedConsumer } from './consumers/enterprise-agent-updated.consumer.js';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';

/**
 * Kafka Module
 * 
 * Provides Kafka consumer and producer functionality.
 * Automatically starts consumers on module initialization.
 * 
 * Note: Kafka integration is disabled when NODE_ENV === 'local' to prevent
 * connection attempts in local development environments.
 */
@Module({
	providers: [
		KafkaClientService,
		KafkaProducerService,
		EnterpriseAgentUpdatedConsumer,
	],
	exports: [
		KafkaClientService,
		KafkaProducerService,
	],
})
export class KafkaModule implements OnModuleInit, OnModuleDestroy {
	constructor(
		private readonly logger: LoggerService,
		private readonly configService: ConfigService,
		private readonly enterpriseAgentUpdatedConsumer: EnterpriseAgentUpdatedConsumer,
	) {
		this.logger.setContext('KafkaModule');
	}

	async onModuleInit() {
		const nodeEnv = this.configService.get('NODE_ENV');
		
		// Skip Kafka initialization in local environment
		if (nodeEnv === 'local') {
			this.logger.info('Kafka module skipped - NODE_ENV is "local". Kafka integration only runs in AWS environments.');
			return;
		}

		this.logger.info('Initializing Kafka module...');
		try {
			await this.enterpriseAgentUpdatedConsumer.start();
			this.logger.info('Kafka module initialized successfully');
		} catch (error) {
			this.logger.error('Failed to initialize Kafka module - continuing without Kafka', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			this.logger.warn('Service will continue to run, but Kafka consumer is unavailable. Messages will not be consumed until Kafka is available.');
			// Don't throw - allow service to start without Kafka
		}
	}

	async onModuleDestroy() {
		const nodeEnv = this.configService.get('NODE_ENV');
		
		// Skip Kafka shutdown in local environment
		if (nodeEnv === 'local') {
			return;
		}

		this.logger.info('Shutting down Kafka module...');
		try {
			await this.enterpriseAgentUpdatedConsumer.stop();
			this.logger.info('Kafka module shut down successfully');
		} catch (error) {
			this.logger.error('Error shutting down Kafka module', {
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}
}

