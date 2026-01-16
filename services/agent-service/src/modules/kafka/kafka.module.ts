import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { EnterpriseAgentUpdatedConsumer } from './consumers/enterprise-agent-updated.consumer.js';
import { SponsorChangedService } from './sponsor-changed.service.js';
import { SponsorChangedController } from './sponsor-changed.controller.js';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { KafkaMessageProcessingController } from './kafka-message-processing.controller.js';
import { KafkaMessageCleanupService } from './kafka-message-cleanup.service.js';
import { AgentModule } from '../agents/agent.module.js';
import { KafkaMessageProcessingEntity } from '@exprealty/database';
import { PaginationModule } from '../../common/pagination/pagination.module.js';

/**
 * Kafka Module
 * 
 * Provides Kafka consumer and producer functionality.
 * 
 * Note: Consumer initialization is handled by OnApplicationBootstrap lifecycle hook
 * in EnterpriseAgentUpdatedConsumer, matching transaction-service's pattern.
 * This ensures the consumer only starts after the app is fully bootstrapped and
 * only shuts down during actual app shutdown, not during module lifecycle events.
 * 
 * Kafka integration is disabled when NODE_ENV === 'local' to prevent
 * connection attempts in local development environments.
 */
@Module({
	imports: [
		AgentModule, // Required for IAgentRepository
		TypeOrmModule.forFeature([KafkaMessageProcessingEntity]),
		PaginationModule, // Required for PaginationInterceptor
	],
	providers: [
		KafkaClientService,
		KafkaProducerService,
		EnterpriseAgentUpdatedConsumer,
		SponsorChangedService,
		KafkaMessageProcessingService,
		KafkaMessageCleanupService,
	],
	controllers: [
		SponsorChangedController,
		KafkaMessageProcessingController,
	],
	exports: [
		KafkaClientService,
		KafkaProducerService,
	],
})
export class KafkaModule {
	// No lifecycle hooks needed - consumer handles its own lifecycle via OnApplicationBootstrap/OnApplicationShutdown
}

