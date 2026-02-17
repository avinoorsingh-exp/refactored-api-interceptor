/**
 * @exprealty/database
 *
 * TypeORM entities, migrations, and database configuration for eXpRealty platform.
 * Implements persistence layer for domain models from @exprealty/shared-domain.
 *
 * @packageDocumentation
 */

// ============================================================================
// Base Entities
// ============================================================================

/**
 * Base auditable entity providing audit trail fields.
 * All domain entities should extend this class.
 * Audit fields are filterable/sortable but NOT searchable by default.
 * @public
 */
export { AuditableEntity } from './entities/core/auditable.entity.js'

/**
 * Extended auditable entity with searchable audit fields.
 * Use this when entities need created/lastModified/modifiedBy in text search.
 * @public
 */
export { SearchableAuditableEntity } from './entities/core/searchable-auditable.entity.js'

// ============================================================================
// Entities
// ============================================================================

/**
 * TypeORM entity for Address table.
 * @public
 */
export { AddressEntity } from './entities/core/address.entity.js'

/**
 * TypeORM entity for AgentCompany table.
 * @public
 */
export { AgentCompanyEntity } from './entities/core/agent-company.entity.js'

/**
 * TypeORM entity for AgentCompanyAssociation junction table.
 * @public
 */
export { AgentCompanyAssociationEntity } from './entities/core/agent-company-association.entity.js'

/**
 * TypeORM entity for Agent table.
 * @public
 */
export { AgentEntity } from './entities/core/agent.entity.js'

/**
 * TypeORM entity for AgentAddress join table.
 * @public
 */
export { AgentAddressEntity } from './entities/core/agent-address.entity.js'

/**
 * TypeORM entity for Company table.
 * @public
 */
export { CompanyEntity } from './entities/core/company.entity.js'

/**
 * TypeORM entity for ExternalReference table.
 * @public
 */
export { ExternalReferenceEntity } from './entities/core/external-reference.entity.js'

/**
 * TypeORM entity for CompanyExternalReference join table.
 * @public
 */
export { CompanyExternalReferenceEntity } from './entities/core/company-external-reference.entity.js'

/**
 * TypeORM entity for AgentExternalReference join table.
 * @public
 */
export { AgentExternalReferenceEntity } from './entities/core/agent-external-reference.entity.js'

/**
 * TypeORM entity for OfficeExternalReference join table.
 * @public
 */
export { OfficeExternalReferenceEntity } from './entities/core/office-external-reference.entity.js'

/**
 * TypeORM entity for Office table.
 * @public
 */
export { OfficeEntity } from './entities/core/office.entity.js'

/**
 * TypeORM entity for AgentOffice join table.
 * @public
 */
export { AgentOfficeEntity } from './entities/core/agent-office.entity.js'

/**
 * TypeORM entity for PayPlan table.
 * @public
 */
export { PayPlanEntity } from './entities/core/pay-plan.entity.js'

/**
 * TypeORM entity for PaymentSettings table.
 * @public
 */
export { PaymentSettingsEntity } from './entities/core/payment-settings.entity.js'

/**
 * TypeORM entity for PaymentSettingsVariant table.
 * @public
 */
export { PaymentSettingsVariantEntity } from './entities/core/payment-settings-variant.entity.js'

/**
 * TypeORM entity for PlanVariant table.
 * @public
 */
export { PlanVariantEntity } from './entities/core/plan-variant.entity.js'

/**
 * TypeORM entity for PayPlanVariant join table.
 * @public
 */
export { PayPlanVariantEntity } from './entities/core/pay-plan-variant.entity.js'

/**
 * TypeORM entity for Language table.
 * @public
 */
export { LanguageEntity } from './entities/core/language.entity.js'

/**
 * TypeORM entity for AgentLanguage join table.
 * @public
 */
export { AgentLanguageEntity } from './entities/core/agent-language.entity.js'

/**
 * TypeORM entity for PublicProfile table.
 * @public
 */
export { PublicProfileEntity } from './entities/core/public-profile.entity.js'

/**
 * TypeORM entity for ContactMethod table.
 * @public
 */
export { ContactMethodEntity } from './entities/core/contact-method.entity.js'

/**
 * TypeORM entity for EmailForward table.
 * @public
 */
export { EmailForwardEntity } from './entities/core/email-forward.entity.js'

/**
 * TypeORM entity for Social table.
 * @public
 */
export { SocialEntity } from './entities/core/social.entity.js'

/**
 * TypeORM entity for Specialty table.
 * @public
 */
export { SpecialtyEntity } from './entities/core/specialty.entity.js'

/**
 * TypeORM entity for AgentSpecialty join table.
 * @public
 */
export { AgentSpecialtyEntity } from './entities/core/agent-specialty.entity.js'

/**
 * TypeORM entity for AgentMLS join table.
 * @public
 */
export { AgentMLSEntity } from './entities/core/agent-mls.entity.js'

/**
 * TypeORM entity for ActiveLocation table.
 * @public
 */
export { ActiveLocationEntity } from './entities/core/active-location.entity.js'

/**
 * TypeORM entity for LineOfBusiness table.
 * @public
 */
export { LineOfBusinessEntity } from './entities/core/line-of-business.entity.js'

/**
 * TypeORM entity for License table.
 * @public
 */
export { LicenseEntity } from './entities/core/license.entity.js'

/**
 * TypeORM entity for Note table.
 * @public
 */
export { NoteEntity } from './entities/core/note.entity.js'

/**
 * TypeORM entity for LifecycleEvent table.
 * @public
 */
export { LifecycleEventEntity } from './entities/core/lifecycle-event.entity.js'

/**
 * TypeORM entity for LicenseEvent table.
 * @public
 */
export { LicenseEventEntity } from './entities/core/license-event.entity.js'

/**
 * TypeORM entity for Relationship table.
 * @public
 */
export { RelationshipEntity } from './entities/core/relationship.entity.js'

/**
 * TypeORM entity for SponsorConfiguration table.
 * @public
 */
export { SponsorConfigurationEntity } from './entities/core/sponsor-configuration.entity.js'

/**
 * TypeORM entity for MLS table.
 * @public
 */
export { MLSEntity } from './entities/core/mls.entity.js'

/**
 * TypeORM entity for Country table.
 * @public
 */
export { CountryEntity } from './entities/core/country.entity.js'

/**
 * TypeORM entity for Currency table.
 * Stores ISO 4217 currency reference data.
 * @public
 */
export { CurrencyEntity } from './entities/core/currency.entity.js'

/**
 * TypeORM entity for System table.
 * Represents a system configuration within a country.
 * @public
 */
export { SystemEntity } from './entities/core/system.entity.js'

/**
 * TypeORM entity for Region table.
 * @public
 */
export { RegionEntity } from './entities/core/region.entity.js'

/**
 * TypeORM entity for State table.
 * @public
 */
export { StateEntity } from './entities/core/state.entity.js'

/**
 * TypeORM entity for Program table.
 * @public
 */
export { ProgramEntity } from './entities/core/program.entity.js'

/**
 * TypeORM entity for CountryProgram join table.
 * @public
 */
export { CountryProgramEntity } from './entities/core/country-program.entity.js'

/**
 * TypeORM entity for OrganizationContact table.
 * @public
 */
export { OrganizationContactEntity } from './entities/core/organization-contact.entity.js'

/**
 * TypeORM entity for W9 table.
 * @public
 */
export { W9Entity } from './entities/core/w9.entity.js'

/**
 * TypeORM entity for W9Address join table.
 * @public
 */
export { W9AddressEntity } from './entities/core/w9-address.entity.js'

/**
 * TypeORM entity for Tax table.
 * @public
 */
export { TaxEntity } from './entities/core/tax.entity.js'
export type { TaxIdType } from './entities/core/tax.entity.js'

/**
 * TypeORM entity for AgentTax junction table.
 * @public
 */
export { AgentTaxEntity } from './entities/core/agent-tax.entity.js'

/**
 * TypeORM entity for OfficeAddress join table.
 * @public
 */
export { OfficeAddressEntity } from './entities/core/office-address.entity.js'

/**
 * TypeORM entity for Artifact table.
 * @public
 */
export { ArtifactEntity } from './entities/core/artifact.entity.js'

/**
 * TypeORM entity for CustomFlag table.
 * @beta - Experimental entity, subject to change
 */
export { CustomFlagEntity } from './entities/core/custom-flag.entity.js'

/**
 * TypeORM entity for Fees table.
 * @beta - Experimental entity, subject to change
 */
export { FeesEntity } from './entities/core/fees.entity.js'

/**
 * TypeORM entity for Approval table.
 * @beta - Experimental entity, subject to change
 */
export { ApprovalEntity } from './entities/core/approval.entity.js'

/**
 * TypeORM entity for KafkaMessageProcessing table.
 * Tracks Kafka message processing status, retries, errors, and idempotency.
 * @public
 */
export { KafkaMessageProcessingEntity, KafkaMessageStatus } from './entities/core/kafka-message-processing.entity.js'

/**
 * TypeORM entity for KafkaService table.
 * Stores Kafka service definitions (consumers and producers).
 * Runtime state is NOT stored here - only service configuration.
 * @public
 */
export { KafkaServiceEntity, KafkaServiceType } from './entities/core/kafka-service.entity.js'

/**
 * TypeORM entity for AdminJob table.
 * Stores scheduled job metadata and configuration.
 * @public
 */
export { AdminJobEntity } from './entities/core/admin-job.entity.js'

/**
 * TypeORM entity for AdminJobExecution table.
 * Stores execution history for scheduled jobs.
 * @public
 */
export { AdminJobExecutionEntity, AdminJobExecutionStatus } from './entities/core/admin-job-execution.entity.js'

/**
 * TypeORM entity for ApiActor table.
 * Tracks external actors (users, API keys, service accounts) that make API requests.
 * @public
 */
export { ApiActorEntity } from './entities/core/api-actor.entity.js'

/**
 * TypeORM entity for ApiRequestLog table.
 * High-volume, append-only log of all API requests.
 * @public
 */
export { ApiRequestLogEntity } from './entities/core/api-request-log.entity.js'

/**
 * TypeORM entity for ApiRouteStats table.
 * Pre-aggregated statistics by route, method, and time bucket.
 * @public
 */
export { ApiRouteStatsEntity } from './entities/core/api-route-stats.entity.js'

// ============================================================================
// Query Decorators
// ============================================================================

/**
 * Decorators for marking entity fields as filterable, sortable, or searchable.
 * Used by QueryService to validate and process query parameters.
 * @public
 */
export {
	Searchable,
	Filterable,
	Sortable,
	getSearchableFields,
	getSearchableFieldsConfig,
	getFilterableFields,
	getFilterableFieldsConfig,
	getSortableFields,
	ALL_FILTER_OPERATORS,
} from './decorators/searchable-decorators.js'

export type { 
	SearchableOptions,
	FilterableOptions,
	FilterableFieldConfig,
	FilterValidationOptions,
	FilterOperator,
} from './decorators/searchable-decorators.js'

// ============================================================================
// Search Strategy Types
// ============================================================================

/**
 * Types and interfaces for search strategies.
 * Used by agent-service to implement type-specific search logic.
 * @public
 */
export {
	SearchableFieldType,
	SearchableFieldConfig,
	ISearchStrategy,
} from './query/types/search-strategy.types.js'

// ============================================================================
// Data Source
// ============================================================================

/**
 * TypeORM DataSource configuration and initialization utilities.
 * Import from '@exprealty/database/data-source' for migration scripts.
 * @public
 */
export { AppDataSource, initializeDataSource, closeDataSource } from './data-source.js'
