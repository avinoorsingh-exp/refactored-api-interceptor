/**
 * @exprealty/shared-domain
 *
 * Domain models and validation schemas for the platform.
 * All exports are @public unless marked @internal.
 */


// --- Common atoms
export * from './common/enums.js'
export * from './common/capabilities.js'
export * from './common/logging.js'
export * from './common/paging.js'
export * from './common/problem-details.js' // <-- NEW
export * from './common/query/index.js'

// --- Validation
export { validationErrorMap } from './validation/error-map.js'

// --- Audit
export { AuditableSchema, type Auditable } from './schemas/audit.js'

// ============================================================================
// VALUE OBJECTS
// ============================================================================

/**
 * Validated name string (2-50 characters).
 * @public
 */
export { NameBranded, type Name } from './value-objects/name.js'

/**
 * Validated email address.
 * @public
 */
export { EmailBranded, type Email } from './value-objects/email.js'

/**
 * ISO 8601 date strings (YYYY-MM-DD) and UTC timestamps.
 * @public
 */
export { DateOnlyISO, InstantUTC } from './value-objects/dates.js'
export type {
	DateOnlyISO as DateOnlyISOType,
	InstantUTC as InstantUTCType,
} from './value-objects/dates.js'

/**
 * Hashed value (SHA-256, bcrypt, etc.).
 * @public
 */
export { HashBranded, type Hash } from './value-objects/hash.js'

/**
 * Postal code value object.
 * @public
 */
export { PostalCodeBranded, type PostalCode } from './value-objects/postal-code.js'

/**
 * City name value object.
 * @public
 */
export { CityBranded, type City } from './value-objects/city.js'

/**
 * Phone number value object.
 * @public
 */
export { PhoneNumberBranded, type PhoneNumber } from './value-objects/phone-number.js'

/**
 * URL value object.
 * @public
 */
export { UrlBranded, type Url } from './value-objects/url.js'

// ============================================================================
// CONSTRAINTS (SHARED BETWEEN ZOD AND TYPEORM)
// ============================================================================

/**
 * Field length and validation constraints.
 * These constants are used by both Zod schemas and TypeORM entities to ensure consistency.
 * @public
 */
export {
	NAME as NAME_CONSTRAINTS,
	PHONE as PHONE_CONSTRAINTS,
	EMAIL as EMAIL_CONSTRAINTS,
	ADDRESS as ADDRESS_CONSTRAINTS,
	ID as ID_CONSTRAINTS,
	AGENT as AGENT_CONSTRAINTS,
	COMPANY as COMPANY_CONSTRAINTS,
	OFFICE as OFFICE_CONSTRAINTS,
	EXTERNAL_REFERENCE as EXTERNAL_REFERENCE_CONSTRAINTS,
	LANGUAGE as LANGUAGE_CONSTRAINTS,
	CONTACT_METHOD as CONTACT_METHOD_CONSTRAINTS,
	EMAIL_FORWARD as EMAIL_FORWARD_CONSTRAINTS,
	SOCIAL as SOCIAL_CONSTRAINTS,
	SPECIALTY as SPECIALTY_CONSTRAINTS,
	ACTIVE_LOCATION as ACTIVE_LOCATION_CONSTRAINTS,
	LINE_OF_BUSINESS as LINE_OF_BUSINESS_CONSTRAINTS,
	LICENSE as LICENSE_CONSTRAINTS,
	NOTE as NOTE_CONSTRAINTS,
	LIFECYCLE_EVENT as LIFECYCLE_EVENT_CONSTRAINTS,
	LICENSE_EVENT as LICENSE_EVENT_CONSTRAINTS,
	RELATIONSHIP as RELATIONSHIP_CONSTRAINTS,
	MLS as MLS_CONSTRAINTS,
	COUNTRY as COUNTRY_CONSTRAINTS,
	REGION as REGION_CONSTRAINTS,
	STATE as STATE_CONSTRAINTS,
	PROGRAM as PROGRAM_CONSTRAINTS,
	ORGANIZATION_CONTACT as ORGANIZATION_CONTACT_CONSTRAINTS,
	W9 as W9_CONSTRAINTS,
	TAX as TAX_CONSTRAINTS,
	ARTIFACT as ARTIFACT_CONSTRAINTS,
	CUSTOM_FLAG as CUSTOM_FLAG_CONSTRAINTS,
	FEES as FEES_CONSTRAINTS,
	APPROVAL as APPROVAL_CONSTRAINTS,
	URL as URL_CONSTRAINTS,
	TEXT as TEXT_CONSTRAINTS,
} from './value-objects/contraints.js'

// ============================================================================
// ENTITIES - ADDRESS
// ============================================================================

/**
 * Address entity schemas and types.
 * @public
 */
export {
	AddressType,
	AddressRoleType,
	AddressBaseSchema,
	AddressExpandedSchema,
	type AddressBase,
	type AddressExpanded,
	type Address,
	CreateAddressInput,
	type CreateAddressInput as CreateAddressInputType,
	UpdateAddressInput,
	type UpdateAddressInput as UpdateAddressInputType,
} from './schemas/address.js'

// ============================================================================
// ENTITIES - AGENT ADDRESS (JOIN TABLE)
// ============================================================================

/**
 * Agent-Address association schemas and types.
 * Uses composite key (agentId, addressId) with isPrimary flag.
 * @public
 */
export {
	AgentAddressSchema,
	type AgentAddress,
	CreateAgentAddressInput,
	type CreateAgentAddressInput as CreateAgentAddressInputType,
	UpdateAgentAddressInput,
	type UpdateAgentAddressInput as UpdateAgentAddressInputType,
} from './schemas/agent-address.js'

// ============================================================================
// ENTITIES - COMPANY
// ============================================================================

/**
 * Company entity schemas and types.
 * @public
 */
export {
	CompanyBaseSchema,
	CompanyExpandedSchema,
	type CompanyBase,
	type CompanyExpanded,
	type Company,
	CreateCompanyInputSchema,
	type CreateCompanyInput,
	UpdateCompanyInputSchema,
	type UpdateCompanyInput,
	CompanyIdParamSchema,
	type CompanyIdParam,
} from './schemas/company.js'

// ============================================================================
// ENTITIES - OFFICE
// ============================================================================

/**
 * Office entity schemas and types.
 * @public
 */
export {
	OFFICE_LIFECYCLE_VALUES,
	OfficeLifecycleStatus,
	OfficeBaseSchema,
	OfficeExpandedSchema,
	OfficeSchema,
	type OfficeBase,
	type OfficeExpanded,
	type Office,
	CreateOfficeInputSchema,
	type CreateOfficeInput,
	UpdateOfficeInputSchema,
	type UpdateOfficeInput,
	OfficeIdParamSchema,
	type OfficeIdParam,
} from './schemas/office.js'

// ============================================================================
// ENTITIES - AGENT COMPANY
// ============================================================================

/**
 * Agent Company entity schemas and types.
 * @public
 */
export {
	AgentCompanyBaseSchema,
	AgentCompanyExpandedSchema,
	type AgentCompanyBase,
	type AgentCompanyExpanded,
	type AgentCompany,
	CreateAgentCompanyInput,
	type CreateAgentCompanyInput as CreateAgentCompanyInputType,
	UpdateAgentCompanyInput,
	type UpdateAgentCompanyInput as UpdateAgentCompanyInputType,
} from './schemas/agent-company.js'

// ============================================================================
// ENTITIES - EXTERNAL REFERENCE
// ============================================================================

/**
 * External Reference entity schemas and types.
 * @public
 */
export {
	ExternalReferenceBaseSchema,
	ExternalReferenceExpandedSchema,
	type ExternalReferenceBase,
	type ExternalReferenceExpanded,
	type ExternalReference,
	CreateExternalReferenceInput,
	type CreateExternalReferenceInput as CreateExternalReferenceInputType,
	UpdateExternalReferenceInput,
	type UpdateExternalReferenceInput as UpdateExternalReferenceInputType,
} from './schemas/external-reference.js'

// ============================================================================
// ENTITIES - COMPANY EXTERNAL REFERENCE (JOIN TABLE)
// ============================================================================

/**
 * Company-ExternalReference association schemas and types.
 * @public
 */
export {
	CompanyExternalReferenceBaseSchema,
	CompanyExternalReferenceExpandedSchema,
	type CompanyExternalReferenceBase,
	type CompanyExternalReferenceExpanded,
	type CompanyExternalReference,
	CreateCompanyExternalReferenceInput,
	type CreateCompanyExternalReferenceInput as CreateCompanyExternalReferenceInputType,
} from './schemas/company-external-reference.js'

// ============================================================================
// ENTITIES - AGENT EXTERNAL REFERENCE (JOIN TABLE)
// ============================================================================

/**
 * Agent-ExternalReference association schemas and types.
 * @public
 */
export {
	AgentExternalReferenceBaseSchema,
	AgentExternalReferenceExpandedSchema,
	type AgentExternalReferenceBase,
	type AgentExternalReferenceExpanded,
	type AgentExternalReference,
	CreateAgentExternalReferenceInput,
	type CreateAgentExternalReferenceInput as CreateAgentExternalReferenceInputType,
} from './schemas/agent-external-reference.js'

// ============================================================================
// ENTITIES - OFFICE EXTERNAL REFERENCE (JOIN TABLE)
// ============================================================================

/**
 * Office-ExternalReference association schemas and types.
 * @public
 */
export {
	OfficeExternalReferenceBaseSchema,
	OfficeExternalReferenceExpandedSchema,
	type OfficeExternalReferenceBase,
	type OfficeExternalReferenceExpanded,
	type OfficeExternalReference,
	CreateOfficeExternalReferenceInput,
	type CreateOfficeExternalReferenceInput as CreateOfficeExternalReferenceInputType,
} from './schemas/office-external-reference.js'

// ============================================================================
// ENTITIES - AGENT
// ============================================================================

/**
 * Agent entity schemas and types.
 * @public
 */
export {
	AGENT_LIFECYCLE_VALUES,
	AgentTitle,
	AgentSuffix,
	AgentLifecycleStatus,
	AgentSchema,
	type Agent,
	CreateAgentInput,
	type CreateAgentInput as CreateAgentInputType,
	UpdateAgentInput,
	type UpdateAgentInput as UpdateAgentInputType,
	AgentExpandedSchema,
	type AgentExpanded,
	AgentIdParamSchema,
	type AgentIdParam,
} from './schemas/agent.js'

// ============================================================================
// ENTITIES - PUBLIC PROFILE
// ============================================================================

/**
 * PublicProfile entity schemas and types.
 * @public
 */
export {
	PublicProfileBaseSchema,
	PublicProfileExpandedSchema,
	type PublicProfile,
	type PublicProfileExpanded,
	CreatePublicProfileInput,
	type CreatePublicProfileInputType,
	UpdatePublicProfileInput,
	type UpdatePublicProfileInputType,
} from './schemas/public-profile.js'

// ============================================================================
// ENTITIES - CONTACT METHOD
// ============================================================================

/**
 * ContactMethod entity schemas and types.
 * @public
 */
export {
	ContactMethodChannelSchema,
	ContactMethodSubTypeSchema,
	EmailSubTypeSchema,
	PhoneSubTypeSchema,
	ContactMethodBaseSchema,
	ContactMethodExpandedSchema,
	type ContactMethod,
	type ContactMethodExpanded,
	CreateContactMethodInput,
	type CreateContactMethodInputType,
	UpdateContactMethodInput,
	type UpdateContactMethodInputType,
	ContactMethodIdParamSchema,
	type ContactMethodIdParam,
} from './schemas/contact-method.js'

// ============================================================================
// ENTITIES - EMAIL FORWARD
// ============================================================================

/**
 * EmailForward entity schemas and types.
 * @public
 */
export {
	EmailForwardBaseSchema,
	EmailForwardExpandedSchema,
	type EmailForward,
	type EmailForwardExpanded,
	CreateEmailForwardInput,
	type CreateEmailForwardInputType,
	UpdateEmailForwardInput,
	type UpdateEmailForwardInputType,
} from './schemas/email-forward.js'

// ============================================================================
// ENTITIES - SOCIAL
// ============================================================================

/**
 * Social entity schemas and types.
 * @public
 */
export {
	SocialContextSchema,
	SocialBaseSchema,
	SocialExpandedSchema,
	type Social,
	type SocialExpanded,
	CreateSocialInput,
	type CreateSocialInputType,
	UpdateSocialInput,
	type UpdateSocialInputType,
} from './schemas/social.js'

// ============================================================================
// ENTITIES - LANGUAGE
// ============================================================================

/**
 * Language entity schemas and types.
 * @public
 */
export {
	LanguageCodeSchema,
	type LanguageCode,
	LanguageBaseSchema,
	LanguageExpandedSchema,
	type Language,
	type LanguageBase,
	type LanguageExpanded,
	CreateLanguageInputSchema,
	type CreateLanguageInput,
	UpdateLanguageInputSchema,
	type UpdateLanguageInput,
} from './schemas/language.js'

// ============================================================================
// ENTITIES - AGENT LANGUAGE (JOIN TABLE)
// ============================================================================

/**
 * AgentLanguage junction table schemas and types.
 * @public
 */
export {
	AgentLanguageBaseSchema,
	AgentLanguageExpandedSchema,
	type AgentLanguage,
	type AgentLanguageBase,
	type AgentLanguageExpanded,
	CreateAgentLanguageInputSchema,
	type CreateAgentLanguageInput,
	UpdateAgentLanguageInputSchema,
	type UpdateAgentLanguageInput,
} from './schemas/agent-language.js'

// ============================================================================
// ENTITIES - SPECIALTY
// ============================================================================

/**
 * Specialty entity schemas and types.
 * @public
 */
export {
	SpecialtyBaseSchema,
	SpecialtyExpandedSchema,
	type Specialty,
	type SpecialtyBase,
	type SpecialtyExpanded,
	CreateSpecialtyInputSchema,
	type CreateSpecialtyInput,
	UpdateSpecialtyInputSchema,
	type UpdateSpecialtyInput,
} from './schemas/specialty.js'

// ============================================================================
// ENTITIES - AGENT SPECIALTY (JOIN TABLE)
// ============================================================================

/**
 * AgentSpecialty junction table schemas and types.
 * @public
 */
export {
	AgentSpecialtyBaseSchema,
	AgentSpecialtyExpandedSchema,
	type AgentSpecialty,
	type AgentSpecialtyBase,
	type AgentSpecialtyExpanded,
	CreateAgentSpecialtyInputSchema,
	type CreateAgentSpecialtyInput,
	UpdateAgentSpecialtyInputSchema,
	type UpdateAgentSpecialtyInput,
} from './schemas/agent-specialty.js'

// ============================================================================
// ENTITIES - AGENT MLS (JOIN TABLE)
// ============================================================================

/**
 * AgentMLS junction table schemas and types.
 * @public
 */
export {
	AgentMLSBaseSchema,
	AgentMLSExpandedSchema,
	type AgentMLS,
	type AgentMLSBase,
	type AgentMLSExpanded,
	CreateAgentMLSInputSchema,
	type CreateAgentMLSInput,
	UpdateAgentMLSInputSchema,
	type UpdateAgentMLSInput,
} from './schemas/agent-mls.js'

// ============================================================================
// ENTITIES - ACTIVE LOCATION
// ============================================================================

/**
 * ActiveLocation entity schemas and types.
 * @public
 */
export {
	ActiveLocationBaseSchema,
	ActiveLocationExpandedSchema,
	type ActiveLocation,
	type ActiveLocationBase,
	type ActiveLocationExpanded,
	CreateActiveLocationInputSchema,
	type CreateActiveLocationInput,
	UpdateActiveLocationInputSchema,
	type UpdateActiveLocationInput,
} from './schemas/active-location.js'

// ============================================================================
// ENTITIES - LINE OF BUSINESS
// ============================================================================

/**
 * LineOfBusiness entity schemas and types.
 * @public
 */
export {
	LineOfBusinessBaseSchema,
	LineOfBusinessExpandedSchema,
	type LineOfBusiness,
	type LineOfBusinessBase,
	type LineOfBusinessExpanded,
	CreateLineOfBusinessInputSchema,
	type CreateLineOfBusinessInput,
	UpdateLineOfBusinessInputSchema,
	type UpdateLineOfBusinessInput,
} from './schemas/line-of-business.js'

// ============================================================================
// ENTITIES - LICENSE
// ============================================================================

/**
 * License entity schemas and types.
 * @public
 */
export {
	LicenseTypeSchema,
	type LicenseType,
	LicenseBaseSchema,
	LicenseExpandedSchema,
	type License,
	type LicenseBase,
	type LicenseExpanded,
	CreateLicenseInputSchema,
	type CreateLicenseInput,
	UpdateLicenseInputSchema,
	type UpdateLicenseInput,
} from './schemas/license.js'

// ============================================================================
// ENTITIES - NOTE
// ============================================================================

/**
 * Note entity schemas and types.
 * @public
 */
export {
	NoteBaseSchema,
	NoteExpandedSchema,
	type Note,
	type NoteBase,
	type NoteExpanded,
	CreateNoteInputSchema,
	type CreateNoteInput,
	UpdateNoteInputSchema,
	type UpdateNoteInput,
} from './schemas/note.js'

// ============================================================================
// ENTITIES - LIFECYCLE EVENT
// ============================================================================

/**
 * LifecycleEvent entity schemas and types.
 * @public
 */
export {
	LifecycleEventTypeSchema,
	type LifecycleEventType,
	LifecycleEventBaseSchema,
	LifecycleEventExpandedSchema,
	type LifecycleEvent,
	type LifecycleEventBase,
	type LifecycleEventExpanded,
	CreateLifecycleEventInputSchema,
	type CreateLifecycleEventInput,
	UpdateLifecycleEventInputSchema,
	type UpdateLifecycleEventInput,
} from './schemas/lifecycle-event.js'

// ============================================================================
// ENTITIES - LICENSE EVENT
// ============================================================================

/**
 * LicenseEvent entity schemas and types.
 * @public
 */
export {
	LicenseEventTypeSchema,
	type LicenseEventType,
	LicenseEventStatusSchema,
	type LicenseEventStatus,
	LicenseEventBaseSchema,
	LicenseEventExpandedSchema,
	type LicenseEvent,
	type LicenseEventBase,
	type LicenseEventExpanded,
	CreateLicenseEventInputSchema,
	type CreateLicenseEventInput,
	UpdateLicenseEventInputSchema,
	type UpdateLicenseEventInput,
} from './schemas/license-event.js'

// ============================================================================
// ENTITIES - RELATIONSHIP
// ============================================================================

/**
 * Relationship entity schemas and types.
 * @public
 */
export {
	RelationshipTypeSchema,
	type RelationshipType,
	RelationshipBaseSchema,
	RelationshipExpandedSchema,
	type Relationship,
	type RelationshipBase,
	type RelationshipExpanded,
	CreateRelationshipInputSchema,
	type CreateRelationshipInput,
	UpdateRelationshipInputSchema,
	type UpdateRelationshipInput,
} from './schemas/relationship.js'

// ============================================================================
// ENTITIES - SPONSOR CONFIGURATION
// ============================================================================

/**
 * SponsorConfiguration entity schemas and types.
 * @public
 */
export {
	SponsorConfigurationBaseSchema,
	SponsorConfigurationExpandedSchema,
	type SponsorConfiguration,
	type SponsorConfigurationBase,
	type SponsorConfigurationExpanded,
	CreateSponsorConfigurationInputSchema,
	type CreateSponsorConfigurationInput,
	UpdateSponsorConfigurationInputSchema,
	type UpdateSponsorConfigurationInput,
} from './schemas/sponsor-configuration.js'

// ============================================================================
// ENTITIES - MLS
// ============================================================================

/**
 * MLS entity schemas and types.
 * @public
 */
export {
	MLS_LIFECYCLE_VALUES,
	MLSLifecycleStatusSchema,
	type MLSLifecycleStatus,
	MLSOrgTypeSchema,
	type MLSOrgType,
	MLSBaseSchema,
	MLSExpandedSchema,
	type MLSType,
	type MLSBase,
	type MLSExpanded,
	CreateMLSInputSchema,
	type CreateMLSInput,
	UpdateMLSInputSchema,
	type UpdateMLSInput,
	MLSIdParamSchema,
	type MLSIdParam,
} from './schemas/mls.js'

// ============================================================================
// ENTITIES - COUNTRY
// ============================================================================

/**
 * Country entity schemas and types.
 * @public
 */
export {
	CountryBaseSchema,
	CountryExpandedSchema,
	type Country,
	type CountryBase,
	type CountryExpanded,
	type CountryApiResponse,
	CreateCountryInputSchema,
	type CreateCountryInput,
	UpdateCountryInputSchema,
	type UpdateCountryInput,
	CountryCodeParamSchema,
	type CountryCodeParam,
} from './schemas/country.js'

// ============================================================================
// ENTITIES - REGION
// ============================================================================

/**
 * Region entity schemas and types.
 * @public
 */
export {
	RegionBaseSchema,
	RegionExpandedSchema,
	type Region,
	type RegionBase,
	type RegionExpanded,
	CreateRegionInputSchema,
	type CreateRegionInput,
	UpdateRegionInputSchema,
	type UpdateRegionInput,
	RegionIdParamSchema,
	type RegionIdParam,
} from './schemas/region.js'

// ============================================================================
// ENTITIES - STATE
// ============================================================================

/**
 * State entity schemas and types.
 * @public
 */
export {
	StateBaseSchema,
	StateExpandedSchema,
	type State,
	type StateBase,
	type StateExpanded,
	CreateStateInputSchema,
	type CreateStateInput,
	UpdateStateInputSchema,
	type UpdateStateInput,
	StateIdParamSchema,
	type StateIdParam,
} from './schemas/state.js'

// ============================================================================
// ENTITIES - PROGRAM
// ============================================================================

/**
 * Program entity schemas and types.
 * @public
 */
export {
	ProgramBaseSchema,
	ProgramExpandedSchema,
	type Program,
	type ProgramBase,
	type ProgramExpanded,
	CreateProgramInputSchema,
	type CreateProgramInput,
	UpdateProgramInputSchema,
	type UpdateProgramInput,
} from './schemas/program.js'

// ============================================================================
// ENTITIES - STATE PROGRAM (JOIN TABLE)
// ============================================================================

/**
 * StateProgram junction table schemas and types.
 * @public
 */
export {
	StateProgramBaseSchema,
	StateProgramExpandedSchema,
	type StateProgram,
	type StateProgramBase,
	type StateProgramExpanded,
	CreateStateProgramInputSchema,
	type CreateStateProgramInput,
} from './schemas/state-program.js'

// ============================================================================
// ENTITIES - PAY PLAN
// ============================================================================

/**
 * PayPlan entity schemas and types.
 * @public
 */
export {
	PayPlanBaseSchema,
	PayPlanExpandedSchema,
	type PayPlan,
	type PayPlanBase,
	type PayPlanExpanded,
	CreatePayPlanInputSchema,
	type CreatePayPlanInput,
	UpdatePayPlanInputSchema,
	type UpdatePayPlanInput,
	PayPlanIdParamSchema,
	type PayPlanIdParam,
} from './schemas/pay-plan.js'

// ============================================================================
// ENTITIES - ORGANIZATION CONTACT
// ============================================================================

/**
 * OrganizationContact entity schemas and types.
 * @public
 */
export {
	OrganizationContactBaseSchema,
	OrganizationContactExpandedSchema,
	type OrganizationContact,
	type OrganizationContactBase,
	type OrganizationContactExpanded,
	CreateOrganizationContactInputSchema,
	type CreateOrganizationContactInput,
	UpdateOrganizationContactInputSchema,
	type UpdateOrganizationContactInput,
} from './schemas/organization-contact.js'

// ============================================================================
// ENTITIES - W9
// ============================================================================

/**
 * W9 entity schemas and types.
 * @public
 */
export {
	FederalTaxClassificationSchema,
	type FederalTaxClassification,
	W9BaseSchema,
	W9ExpandedSchema,
	type W9,
	type W9Base,
	type W9Expanded,
	CreateW9InputSchema,
	type CreateW9Input,
	UpdateW9InputSchema,
	type UpdateW9Input,
} from './schemas/w9.js'

// ============================================================================
// ENTITIES - W9 ADDRESS (JOIN TABLE)
// ============================================================================

/**
 * W9Address junction table schemas and types.
 * @public
 */
export {
	W9AddressBaseSchema,
	W9AddressExpandedSchema,
	type W9Address,
	type W9AddressBase,
	type W9AddressExpanded,
	CreateW9AddressInputSchema,
	type CreateW9AddressInput,
} from './schemas/w9-address.js'

// ============================================================================
// ENTITIES - TAX
// ============================================================================

/**
 * Tax entity schemas and types.
 * @public
 */
export {
	TaxBaseSchema,
	TaxExpandedSchema,
	type Tax,
	type TaxBase,
	type TaxExpanded,
	CreateTaxInputSchema,
	type CreateTaxInput,
	UpdateTaxInputSchema,
	type UpdateTaxInput,
} from './schemas/tax.js'

// ============================================================================
// ENTITIES - OFFICE ADDRESS (JOIN TABLE)
// ============================================================================

/**
 * OfficeAddress junction table schemas and types.
 * @public
 */
export {
	OfficeAddressBaseSchema,
	OfficeAddressExpandedSchema,
	type OfficeAddress,
	type OfficeAddressBase,
	type OfficeAddressExpanded,
	CreateOfficeAddressInputSchema,
	type CreateOfficeAddressInput,
} from './schemas/office-address.js'

// ============================================================================
// ENTITIES - ARTIFACT
// ============================================================================

/**
 * Artifact entity schemas and types.
 * @public
 */
export {
	ArtifactBaseSchema,
	ArtifactExpandedSchema,
	type Artifact,
	type ArtifactBase,
	type ArtifactExpanded,
	CreateArtifactInputSchema,
	type CreateArtifactInput,
	UpdateArtifactInputSchema,
	type UpdateArtifactInput,
} from './schemas/artifact.js'

// ============================================================================
// ENTITIES - CUSTOM FLAG (@beta)
// ============================================================================

/**
 * CustomFlag entity schemas and types.
 * @beta - Experimental entity, subject to change
 */
export {
	CustomFlagScopeSchema,
	type CustomFlagScope,
	CustomFlagTypeSchema,
	type CustomFlagType,
	CustomFlagBaseSchema,
	CustomFlagExpandedSchema,
	type CustomFlag,
	type CustomFlagBase,
	type CustomFlagExpanded,
	CreateCustomFlagInputSchema,
	type CreateCustomFlagInput,
	UpdateCustomFlagInputSchema,
	type UpdateCustomFlagInput,
} from './schemas/custom-flag.js'

// ============================================================================
// ENTITIES - FEES (@beta)
// ============================================================================

/**
 * Fees entity schemas and types.
 * @beta - Experimental entity, subject to change
 */
export {
	FeesBaseSchema,
	FeesExpandedSchema,
	type Fees,
	type FeesBase,
	type FeesExpanded,
	CreateFeesInputSchema,
	type CreateFeesInput,
	UpdateFeesInputSchema,
	type UpdateFeesInput,
} from './schemas/fees.js'

// ============================================================================
// ENTITIES - APPROVAL (@beta)
// ============================================================================

/**
 * Approval entity schemas and types.
 * @beta - Experimental entity, subject to change
 */
export {
	ApprovalStateSchema,
	type ApprovalState,
	ApprovalTemplateSchema,
	type ApprovalTemplate,
	ApprovalBaseSchema,
	ApprovalExpandedSchema,
	type Approval,
	type ApprovalBase,
	type ApprovalExpanded,
	CreateApprovalInputSchema,
	type CreateApprovalInput,
	UpdateApprovalInputSchema,
	type UpdateApprovalInput,
} from './schemas/approval.js'
