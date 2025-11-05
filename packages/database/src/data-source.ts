import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as fs from 'fs'
import { AddressEntity } from './entities/core/address.entity.js'
import { AgentCompanyEntity } from './entities/core/agent-company.entity.js'
import { AgentEntity } from './entities/core/agent.entity.js'
import { AgentAddressEntity } from './entities/core/agent-address.entity.js'
import { CompanyEntity } from './entities/core/company.entity.js'
import { OfficeEntity } from './entities/core/office.entity.js'
// Import ExternalReferenceEntity BEFORE junction tables to avoid circular dependency
import { ExternalReferenceEntity } from './entities/core/external-reference.entity.js'
// Junction tables that reference ExternalReferenceEntity
import { AgentExternalReferenceEntity } from './entities/core/agent-external-reference.entity.js'
import { OfficeExternalReferenceEntity } from './entities/core/office-external-reference.entity.js'
import { CompanyExternalReferenceEntity } from './entities/core/company-external-reference.entity.js'
import { AgentOfficeEntity } from './entities/core/agent-office.entity.js'
import { PayPlanEntity } from './entities/core/pay-plan.entity.js'
import { PaymentSettingsEntity } from './entities/core/payment-settings.entity.js'
import { PaymentSettingsVariantEntity } from './entities/core/payment-settings-variant.entity.js'
import { PlanVariantEntity } from './entities/core/plan-variant.entity.js'
import { PayPlanVariantEntity } from './entities/core/pay-plan-variant.entity.js'
import { LanguageEntity } from './entities/core/language.entity.js'
import { AgentLanguageEntity } from './entities/core/agent-language.entity.js'
import { PublicProfileEntity } from './entities/core/public-profile.entity.js'
import { ContactMethodEntity } from './entities/core/contact-method.entity.js'
import { EmailForwardEntity } from './entities/core/email-forward.entity.js'
import { SocialEntity } from './entities/core/social.entity.js'
import { SpecialtyEntity } from './entities/core/specialty.entity.js'
import { AgentSpecialtyEntity } from './entities/core/agent-specialty.entity.js'
import { AgentMLSEntity } from './entities/core/agent-mls.entity.js'
import { ActiveLocationEntity } from './entities/core/active-location.entity.js'
import { LineOfBusinessEntity } from './entities/core/line-of-business.entity.js'
import { LicenseEntity } from './entities/core/license.entity.js'
import { NoteEntity } from './entities/core/note.entity.js'
import { LifecycleEventEntity } from './entities/core/lifecycle-event.entity.js'
import { LicenseEventEntity } from './entities/core/license-event.entity.js'
import { RelationshipEntity } from './entities/core/relationship.entity.js'
import { SponsorConfigurationEntity } from './entities/core/sponsor-configuration.entity.js'
import { MLSEntity } from './entities/core/mls.entity.js'
import { CountryEntity } from './entities/core/country.entity.js'
import { RegionEntity } from './entities/core/region.entity.js'
import { StateEntity } from './entities/core/state.entity.js'
import { ProgramEntity } from './entities/core/program.entity.js'
import { StateProgramEntity } from './entities/core/state-program.entity.js'
import { OrganizationContactEntity } from './entities/core/organization-contact.entity.js'
import { W9Entity } from './entities/core/w9.entity.js'
import { W9AddressEntity } from './entities/core/w9-address.entity.js'
import { TaxEntity } from './entities/core/tax.entity.js'
import { OfficeAddressEntity } from './entities/core/office-address.entity.js'
import { ArtifactEntity } from './entities/core/artifact.entity.js'
import { CustomFlagEntity } from './entities/core/custom-flag.entity.js'
import { FeesEntity } from './entities/core/fees.entity.js'
import { ApprovalEntity } from './entities/core/approval.entity.js'

/**
 * Get SSL configuration for RDS connections
 * @internal
 */
function getSSLConfig() {
	const useSSL = process.env.DB_SSL === 'true' || process.env.DB_SSL_CA_PATH
	if (!useSSL) {
		return false
	}

	if (process.env.DB_SSL_CA_PATH) {
		try {
			const ca = fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8')
			return {
				ca,
				rejectUnauthorized: true,
			}
		} catch (error) {
			console.warn(`Failed to read SSL CA certificate from ${process.env.DB_SSL_CA_PATH}:`, error)
			return {
				rejectUnauthorized: false,
			}
		}
	}

	// Fallback: SSL without certificate verification (less secure but works)
	return {
		rejectUnauthorized: false,
	}
}

/**
 * TypeORM DataSource configuration for eXpRealty platform.
 *
 * Environment Variables:
 * - DB_HOST: Database host (default: localhost)
 * - DB_PORT: Database port (default: 5432)
 * - DB_USERNAME: Database user (default: postgres)
 * - DB_PASSWORD: Database password (default: postgres)
 * - DB_NAME: Database name (default: transaction_calculator)
 * - DB_SSL: Enable SSL (default: false, set to 'true' for RDS)
 * - DB_SSL_CA_PATH: Path to RDS CA certificate bundle (optional)
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
	ssl: getSSLConfig(),

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
