/**
 * @exprealty/database
 *
 * TypeORM entities, migrations, and database configuration for eXpRealty platform.
 * Implements persistence layer for domain models from @exprealty/shared-domain.
 *
 * @packageDocumentation
 */

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
 * TypeORM entity for StateProgram join table.
 * @public
 */
export { StateProgramEntity } from './entities/core/state-program.entity.js'

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

// ============================================================================
// Data Source
// ============================================================================

/**
 * TypeORM DataSource configuration and initialization utilities.
 * Import from '@exprealty/database/data-source' for migration scripts.
 * @public
 */
export { AppDataSource, initializeDataSource, closeDataSource } from './data-source.js'
