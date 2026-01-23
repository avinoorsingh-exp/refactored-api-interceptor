import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { EnterpriseAgentUpdatedConsumer } from './consumers/enterprise-agent-updated.consumer.js';
import { AuAgentDetailsAgentUpdatedConsumer } from './consumers/au-agent-details-agent-updated.consumer.js';
import { UkAgentDetailsAgentUpdatedConsumer } from './consumers/uk-agent-details-agent-updated.consumer.js';
import { GlobalAdsAgentCreatedConsumer } from './consumers/global-ads-agent-created.consumer.js';
import { GlobalAdsAgentUpdatedConsumer } from './consumers/global-ads-agent-updated.consumer.js';
import { SponsorChangedService } from './sponsor-changed.service.js';
import { SponsorChangedController } from './sponsor-changed.controller.js';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { KafkaMessageProcessingController } from './kafka-message-processing.controller.js';
import { KafkaMessageCleanupService } from './kafka-message-cleanup.service.js';
import { KafkaRuntimeManager } from './kafka-runtime-manager.service.js';
import { KafkaBootstrapService } from './kafka-bootstrap.service.js';
import { KafkaAdminController } from './kafka-admin.controller.js';
import { AgentModule } from '../agents/agent.module.js';
import { KafkaMessageProcessingEntity, KafkaServiceEntity } from '@exprealty/database';
import { PaginationModule } from '../../common/pagination/pagination.module.js';

/**
 * Kafka Module
 * 
 * Provides Kafka consumer and producer functionality with runtime control plane.
 * 
 * Architecture:
 * - KafkaRuntimeManager: Manages runtime state in memory (not persisted)
 * - KafkaBootstrapService: Loads service definitions from DB and starts enabled services
 * - KafkaAdminController: HTTP endpoints for runtime control
 * - Services implement RegisterableKafkaService interface for lifecycle management
 * 
 * Kafka lifecycle is fully decoupled from ORM initialization.
 * Services are started on application bootstrap based on database configuration.
 * 
 * Kafka integration is disabled when NODE_ENV === 'local' to prevent
 * connection attempts in local development environments.
 */
@Module({
	imports: [
		AgentModule, // Required for IAgentRepository
		TypeOrmModule.forFeature([KafkaMessageProcessingEntity, KafkaServiceEntity]),
		PaginationModule, // Required for PaginationInterceptor
	],
	providers: [
		KafkaClientService,
		KafkaRuntimeManager,
		KafkaBootstrapService,
		KafkaProducerService,
		EnterpriseAgentUpdatedConsumer,
		AuAgentDetailsAgentUpdatedConsumer,
		UkAgentDetailsAgentUpdatedConsumer,
		GlobalAdsAgentCreatedConsumer,
		GlobalAdsAgentUpdatedConsumer,
		SponsorChangedService,
		KafkaMessageProcessingService,
		KafkaMessageCleanupService,
	],
	controllers: [
		SponsorChangedController,
		KafkaMessageProcessingController,
		KafkaAdminController,
	],
	exports: [
		KafkaClientService,
		KafkaProducerService,
		KafkaRuntimeManager,
	],
})
export class KafkaModule {
	// Lifecycle is handled by KafkaBootstrapService (OnApplicationBootstrap/OnApplicationShutdown)
}

