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
	LicenseEntity,
	LicenseEventEntity,
	AgentTaxEntity,
	TaxEntity,
	NoteEntity,
	AgentNoteEntity,
	LifecycleEventEntity,
	CountryEntity,
	StateEntity,
	LineOfBusinessEntity,
} from '@exprealty/database';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { AgentTypeOrmRepository } from './agent.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { ContactMethodController } from './contact-methods/contact-method.controller.js';
import { ContactMethodService } from './contact-methods/contact-method.service.js';
import { ContactMethodTypeOrmRepository } from './contact-methods/contact-method.repository.js';
import { AgentAddressController } from './addresses/agent-address.controller.js';
import { AgentAddressService } from './addresses/agent-address.service.js';
import { AgentAddressTypeOrmRepository } from './addresses/agent-address.repository.js';
import { LicenseController } from './licenses/license.controller.js';
import { LicenseService } from './licenses/license.service.js';
import { LicenseTypeOrmRepository } from './licenses/license.repository.js';
import { NoteController } from './notes/note.controller.js';
import { NoteService } from './notes/note.service.js';
import { NoteTypeOrmRepository } from './notes/note.repository.js';
import { ExternalReferenceController } from './external-references/external-reference.controller.js';
import { ExternalReferenceService } from './external-references/external-reference.service.js';
import { ExternalReferenceTypeOrmRepository } from './external-references/external-reference.repository.js';
import { AgentExistsGuard } from '../../common/guards/agent-exists.guard.js';
;

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
			LicenseEntity,
			LicenseEventEntity,
			// Agent tax junction + tax entity for ?include=agentTax
			AgentTaxEntity,
			TaxEntity,
			// Note entities for agent notes
			NoteEntity,
			AgentNoteEntity,
			LifecycleEventEntity,
			// Reference entities for license validation
			CountryEntity,
			StateEntity,
			LineOfBusinessEntity,
		]),
		PaginationModule,
	],
	controllers: [AgentController, ContactMethodController, AgentAddressController, LicenseController, NoteController, ExternalReferenceController],
	providers: [
		AgentService,
		ContactMethodService,
		AgentAddressService,
		LicenseService,
		NoteService,
		ExternalReferenceService,
		ProjectionService,
		AgentExistsGuard,
		// Provide the repository adapter under the port token
		{
			provide: 'IAgentRepository',
			useClass: AgentTypeOrmRepository,
		},
		{
			provide: 'IContactMethodRepository',
			useClass: ContactMethodTypeOrmRepository,
		},
		{
			provide: 'IAgentAddressRepository',
			useClass: AgentAddressTypeOrmRepository,
		},
		{
			provide: 'ILicenseRepository',
			useClass: LicenseTypeOrmRepository,
		},
		{
			provide: 'INoteRepository',
			useClass: NoteTypeOrmRepository,
		},
		{
			provide: 'IExternalReferenceRepository',
			useClass: ExternalReferenceTypeOrmRepository,
		},
		// Provide AgentService under AGENT_SERVICE token for AgentExistsGuard
		{
			provide: 'AGENT_SERVICE',
			useExisting: AgentService,
		},
	],
	exports: [
		AgentService,
		ContactMethodService,
		AgentAddressService,
		LicenseService,
		NoteService,
		ExternalReferenceService,
		AgentExistsGuard,
		// Export AGENT_SERVICE token for AgentExistsGuard in other modules
		'AGENT_SERVICE',
		// Export IAgentRepository token for use in other modules
		{
			provide: 'IAgentRepository',
			useClass: AgentTypeOrmRepository,
		},
	],
})
export class AgentModule {}
