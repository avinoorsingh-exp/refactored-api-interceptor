import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	AgentEntity,
	AgentCompanyEntity,
	AgentOfficeEntity,
	AgentMLSEntity,
	AgentAddressEntity,
	AgentExternalReferenceEntity,
	AgentLanguageEntity,
	ContactMethodEntity,
	PaymentSettingsEntity,
	SponsorConfigurationEntity,
	ActiveLocationEntity,
	RelationshipEntity,
	PublicProfileEntity,
	OfficeEntity,
	MLSEntity,
	AddressEntity,
	ExternalReferenceEntity,
	LanguageEntity,
	PayPlanEntity,
	SocialEntity,
} from '@exprealty/database';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { AgentTypeOrmRepository } from './agent.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { ContactMethodController } from './contact-methods/contact-method.controller.js';
import { ContactMethodService } from './contact-methods/contact-method.service.js';
import { ContactMethodTypeOrmRepository } from './contact-methods/contact-method.repository.js';

/**
 * Module for Agent aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - AgentService depends on IAgentRepository PORT
 * - AgentTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 *
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 *
 * Entity Registration (full graph for TypeORM metadata resolution):
 * - AgentEntity: Main entity for this module
 * - AgentCompanyEntity: Required for ManyToOne agentCompany relation
 * - AgentOfficeEntity: Junction table for Agent-Office relation
 * - AgentMLSEntity: Junction table for Agent-MLS relation
 * - AgentAddressEntity: Junction table for Agent-Address relation
 * - AgentExternalReferenceEntity: Junction table for Agent-ExternalReference relation
 * - AgentLanguageEntity: Junction table for Agent-Language relation
 * - ContactMethodEntity: One-to-many contact methods
 * - PaymentSettingsEntity: One-to-one payment settings
 * - SponsorConfigurationEntity: One-to-one sponsor config
 * - ActiveLocationEntity: One-to-many active locations
 * - RelationshipEntity: Sponsor/mentor relationships
 * - PublicProfileEntity: One-to-one public profile
 * - Related entities: OfficeEntity, MLSEntity, AddressEntity, etc.
 */
@Module({
	imports: [
		// Register AgentEntity and full entity graph for TypeORM metadata resolution
		TypeOrmModule.forFeature([
			// Main entity
			AgentEntity,
			// Direct relations
			AgentCompanyEntity,
			// Junction tables
			AgentOfficeEntity,
			AgentMLSEntity,
			AgentAddressEntity,
			AgentExternalReferenceEntity,
			AgentLanguageEntity,
			// One-to-many/one-to-one relations
			ContactMethodEntity,
			PaymentSettingsEntity,
			SponsorConfigurationEntity,
			ActiveLocationEntity,
			RelationshipEntity,
			PublicProfileEntity,
			// Related entities needed for nested joins
			OfficeEntity,
			MLSEntity,
			AddressEntity,
			ExternalReferenceEntity,
			LanguageEntity,
			PayPlanEntity,
			SocialEntity,
		]),
		PaginationModule,
	],
	controllers: [AgentController, ContactMethodController],
	providers: [
		AgentService,
		ContactMethodService,
		ProjectionService,
		// Provide the repository adapter under the port token
		{
			provide: 'IAgentRepository',
			useClass: AgentTypeOrmRepository,
		},
		{
			provide: 'IContactMethodRepository',
			useClass: ContactMethodTypeOrmRepository,
		},
	],
	exports: [AgentService, ContactMethodService],
})
export class AgentModule {}
