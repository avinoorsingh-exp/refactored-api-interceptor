import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { AddressEntity } from './entities/address.entity.js'
import { AgentCompanyEntity } from './entities/agent-company.entity.js'
import { AgentEntity } from './entities/agent.entity.js'
import { AgentAddressEntity } from './entities/agent-address.entity.js'
import { CompanyEntity } from './entities/company.entity.js'
import { OfficeEntity } from './entities/office.entity.js'
// Import ExternalReferenceEntity BEFORE junction tables to avoid circular dependency
import { ExternalReferenceEntity } from './entities/external-reference.entity.js'
// Junction tables that reference ExternalReferenceEntity
import { AgentExternalReferenceEntity } from './entities/agent-external-reference.entity.js'
import { OfficeExternalReferenceEntity } from './entities/office-external-reference.entity.js'
import { CompanyExternalReferenceEntity } from './entities/company-external-reference.entity.js'
import { AgentOfficeEntity } from './entities/agent-office.entity.js'
import { PayPlanEntity } from './entities/pay-plan.entity.js'
import { PaymentSettingsEntity } from './entities/payment-settings.entity.js'
import { PaymentSettingsVariantEntity } from './entities/payment-settings-variant.entity.js'
import { PlanVariantEntity } from './entities/plan-variant.entity.js'
import { PayPlanVariantEntity } from './entities/pay-plan-variant.entity.js'
import { LanguageEntity } from './entities/language.entity.js'
import { AgentLanguageEntity } from './entities/agent-language.entity.js'
import { PublicProfileEntity } from './entities/public-profile.entity.js'
import { ContactMethodEntity } from './entities/contact-method.entity.js'
import { EmailForwardEntity } from './entities/email-forward.entity.js'
import { SocialEntity } from './entities/social.entity.js'
import { SpecialtyEntity } from './entities/specialty.entity.js'
import { AgentSpecialtyEntity } from './entities/agent-specialty.entity.js'
import { AgentMLSEntity } from './entities/agent-mls.entity.js'
import { ActiveLocationEntity } from './entities/active-location.entity.js'
import { LineOfBusinessEntity } from './entities/line-of-business.entity.js'
import { LicenseEntity } from './entities/license.entity.js'
import { NoteEntity } from './entities/note.entity.js'
import { LifecycleEventEntity } from './entities/lifecycle-event.entity.js'
import { LicenseEventEntity } from './entities/license-event.entity.js'
import { RelationshipEntity } from './entities/relationship.entity.js'
import { SponsorConfigurationEntity } from './entities/sponsor-configuration.entity.js'
import { MLSEntity } from './entities/mls.entity.js'
import { CountryEntity } from './entities/country.entity.js'
import { RegionEntity } from './entities/region.entity.js'
import { StateEntity } from './entities/state.entity.js'
import { ProgramEntity } from './entities/program.entity.js'
import { StateProgramEntity } from './entities/state-program.entity.js'
import { OrganizationContactEntity } from './entities/organization-contact.entity.js'
import { W9Entity } from './entities/w9.entity.js'
import { W9AddressEntity } from './entities/w9-address.entity.js'
import { TaxEntity } from './entities/tax.entity.js'
import { OfficeAddressEntity } from './entities/office-address.entity.js'
import { ArtifactEntity } from './entities/artifact.entity.js'
import { CustomFlagEntity } from './entities/custom-flag.entity.js'
import { FeesEntity } from './entities/fees.entity.js'
import { ApprovalEntity } from './entities/approval.entity.js'

/**
 * TypeORM DataSource configuration for eXpRealty platform.
 *
 * Environment Variables:
 * - DB_HOST: Database host (default: localhost)
 * - DB_PORT: Database port (default: 5432)
 * - DB_USERNAME: Database user (default: postgres)
 * - DB_PASSWORD: Database password (default: postgres)
 * - DB_NAME: Database name (default: transaction_calculator)
 * - NODE_ENV: Environment (development|production|test)
 *
 * @public
 */
export const AppDataSource = new DataSource({
	type: 'postgres',
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '5432', 10),
	username: process.env.DB_USERNAME || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	database: process.env.DB_NAME || 'agent_database',

	// Entities
	entities: [
		AddressEntity,
		AgentCompanyEntity,
		AgentEntity,
		AgentAddressEntity,
		CompanyEntity,
		OfficeEntity,
		// Core reference entity
		ExternalReferenceEntity,
		// Junction tables that reference ExternalReferenceEntity
		AgentExternalReferenceEntity,
		OfficeExternalReferenceEntity,
		CompanyExternalReferenceEntity,
		AgentOfficeEntity,
		PayPlanEntity,
		PaymentSettingsEntity,
		PaymentSettingsVariantEntity,
		PlanVariantEntity,
		PayPlanVariantEntity,
		LanguageEntity,
		AgentLanguageEntity,
		PublicProfileEntity,
		ContactMethodEntity,
		EmailForwardEntity,
		SocialEntity,
		SpecialtyEntity,
		AgentSpecialtyEntity,
		AgentMLSEntity,
		ActiveLocationEntity,
		LineOfBusinessEntity,
		LicenseEntity,
		NoteEntity,
		LifecycleEventEntity,
		LicenseEventEntity,
		RelationshipEntity,
		SponsorConfigurationEntity,
		MLSEntity,
		CountryEntity,
		RegionEntity,
		StateEntity,
		ProgramEntity,
		StateProgramEntity,
		OrganizationContactEntity,
		W9Entity,
		W9AddressEntity,
		TaxEntity,
		OfficeAddressEntity,
		ArtifactEntity,
		CustomFlagEntity,
		FeesEntity,
		ApprovalEntity,
	],

	// Migrations
	migrations: ['./src/migrations/*.ts'],

	// Migration settings
	migrationsTableName: 'typeorm_migrations',
	migrationsRun: false, // Don't auto-run migrations

	// Schema settings
	synchronize: false, // NEVER use synchronize in production
	logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],

	// Connection pool settings
	extra: {
		max: 20, // Maximum pool size
		min: 5, // Minimum pool size
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 2000,
	},
})

/**
 * Initialize the DataSource (call this before using migrations or queries).
 * @public
 */
export async function initializeDataSource(): Promise<DataSource> {
	if (!AppDataSource.isInitialized) {
		await AppDataSource.initialize()
	}
	return AppDataSource
}

/**
 * Close the DataSource connection.
 * @public
 */
export async function closeDataSource(): Promise<void> {
	if (AppDataSource.isInitialized) {
		await AppDataSource.destroy()
	}
}
