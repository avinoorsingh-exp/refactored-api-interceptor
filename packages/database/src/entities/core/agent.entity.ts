import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, OneToOne, JoinColumn } from 'typeorm'
import { AgentCompanyEntity } from './agent-company.entity.js'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

// Forward declarations for circular dependencies
import type { AgentOfficeEntity } from './agent-office.entity.js'
import type { AgentMLSEntity } from './agent-mls.entity.js'
import type { AgentAddressEntity } from './agent-address.entity.js'
import type { AgentExternalReferenceEntity } from './agent-external-reference.entity.js'
import type { AgentLanguageEntity } from './agent-language.entity.js'
import type { ContactMethodEntity } from './contact-method.entity.js'
import type { PaymentSettingsEntity } from './payment-settings.entity.js'
import type { SponsorConfigurationEntity } from './sponsor-configuration.entity.js'
import type { ActiveLocationEntity } from './active-location.entity.js'
import type { RelationshipEntity } from './relationship.entity.js'
import type { PublicProfileEntity } from './public-profile.entity.js'

/**
 * Agent title enum values.
 * @public
 */
export type AgentTitle = 'Mr' | 'Mrs' | 'Ms' | 'Miss'

/**
 * Agent lifecycle status enum values.
 * @public
 */
export type AgentLifecycleStatus =
	| 'Joining'
	| 'Active'
	| 'Inactive'
	| 'Vested'
	| 'Vested Retired'
	| 'Lead Only'

/**
 * TypeORM entity for Agent table.
 * Database representation of the domain Agent type.
 * @public
 */
@Entity({ name: 'agent', schema: 'core' })
export class AgentEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Searchable({ weight: 3, behavior: 'exact', description: 'Unique agent identifier (UUID)' })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Legacy agent ID from old system (BigInt).
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'bigint', nullable: true })
	@Searchable({ type: 'integer', weight: 4, behavior: 'exact', description: 'Legacy agent ID (bigint)', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	agentId?: string

	/**
	 * Agent title (Mr., Mrs., Ms., Miss).
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 2, behavior: 'exact', description: 'Agent title (Mr, Mrs, Ms, Miss)' })
	@Filterable()
	@Sortable()
	title?: AgentTitle

	/**
	 * Agent's given name.
	 * @public
	 */
	@Column({ name: 'first_name', type: 'text' })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Agent first/given name' })
	@Filterable()
	@Sortable()
	firstName!: string

	/**
	 * Agent's middle name (optional).
	 * @public
	 */
	@Column({ name: 'middle_name', type: 'text', nullable: true })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Agent middle name' })
	@Filterable()
	@Sortable()
	middleName?: string

	/**
	 * Agent's family name.
	 * @public
	 */
	@Column({ name: 'last_name', type: 'text' })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Agent last/family name' })
	@Filterable()
	@Sortable()
	lastName!: string

	/**
	 * Name suffix (Jr, Sr, PhD, etc.) - optional.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 2, behavior: 'partial', description: 'Name suffix (Jr, Sr, PhD, etc.)' })
	@Filterable()
	@Sortable()
	suffix?: string

	/**
	 * Agent's preferred/display name (optional).
	 * @public
	 */
	@Column({ name: 'preferred_name', type: 'text', nullable: true })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Agent preferred/display name' })
	@Filterable()
	@Sortable()
	preferredName?: string

	/**
	 * Agent's birth date.
	 * @public
	 */
	@Column({ name: 'birth_date', type: 'timestamp with time zone', nullable: true })
	@Searchable({ type: 'date', weight: 3, behavior: 'range', description: 'Agent birth date' })
	@Filterable()
	@Sortable()
	birthDate?: Date

	/**
	 * Agent lifecycle status.
	 * @public
	 */
	@Column({ name: 'lifecycle_status', type: 'text', nullable: true })
	@Searchable({ weight: 7, behavior: 'exact', description: 'Agent lifecycle status (Joining, Active, Inactive, Vested, Vested Retired, Lead Only)' })
	@Filterable()
	@Sortable()
	lifecycleStatus?: AgentLifecycleStatus

	/**
	 * System ID reference.
	 * @public
	 */
	@Column({ name: 'system_id', type: 'integer', nullable: true })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'System ID reference', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	systemId?: number

	/**
	 * Whether agent is a seed agent.
	 * @public
	 */
	@Column({ name: 'seed_agent', type: 'boolean', default: false })
	@Searchable({ type: 'boolean', weight: 2, behavior: 'exact', description: 'Whether agent is a seed agent' })
	@Filterable()
	@Sortable()
	seedAgent!: boolean

	/**
	 * Date when agent joined.
	 * @public
	 */
	@Column({ name: 'join_date', type: 'timestamp with time zone', nullable: true })
	@Searchable({ type: 'date', weight: 5, behavior: 'range', description: 'Date when agent joined' })
	@Filterable()
	@Sortable()
	joinDate?: Date

	/**
	 * Agent's anniversary date.
	 * @public
	 */
	@Column({ name: 'anniversary_date', type: 'timestamp with time zone', nullable: true })
	@Searchable({ type: 'date', weight: 4, behavior: 'range', description: 'Agent anniversary date' })
	@Filterable()
	@Sortable()
	anniversaryDate?: Date

	/**
	 * Date when agent was terminated.
	 * @public
	 */
	@Column({ name: 'termination_date', type: 'timestamp with time zone', nullable: true })
	@Searchable({ type: 'date', weight: 4, behavior: 'range', description: 'Date when agent was terminated' })
	@Filterable()
	@Sortable()
	terminationDate?: Date

	/**
	 * Whether agent is staff.
	 * @public
	 */
	@Column({ name: 'is_staff', type: 'boolean', default: false })
	@Searchable({ type: 'boolean', weight: 2, behavior: 'exact', description: 'Whether agent is staff member' })
	@Filterable()
	@Sortable()
	isStaff!: boolean

	/**
	 * Foreign key to AgentCompany.
	 * @public
	 */
	@Column({ name: 'agent_company_id', type: 'uuid' })
	@Searchable({ weight: 3, behavior: 'exact', description: 'Agent company ID reference (UUID)' })
	@Filterable()
	@Sortable()
	agentCompanyId!: string

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * Many-to-One relationship with AgentCompany.
	 * @public
	 */
	@ManyToOne(() => AgentCompanyEntity)
	@JoinColumn({ name: 'agent_company_id' })
	agentCompany?: AgentCompanyEntity

	/**
	 * One-to-Many relationship with AgentOffice (junction table).
	 * Links agent to their offices with primary designation.
	 * @public
	 */
	@OneToMany('AgentOfficeEntity', 'agent')
	agentOffices?: AgentOfficeEntity[]

	/**
	 * One-to-Many relationship with AgentMls (junction table).
	 * Links agent to MLS memberships.
	 * @public
	 */
	@OneToMany('AgentMLSEntity', 'agent')
	agentMlsList?: AgentMLSEntity[]

	/**
	 * One-to-Many relationship with AgentAddress (junction table).
	 * Links agent to their addresses with primary designation.
	 * @public
	 */
	@OneToMany('AgentAddressEntity', 'agent')
	agentAddresses?: AgentAddressEntity[]

	/**
	 * One-to-Many relationship with AgentExternalReference.
	 * Links agent to external system references.
	 * @public
	 */
	@OneToMany('AgentExternalReferenceEntity', 'agent')
	externalReferences?: AgentExternalReferenceEntity[]

	/**
	 * One-to-Many relationship with AgentLanguage.
	 * Links agent to languages they speak with proficiency.
	 * @public
	 */
	@OneToMany('AgentLanguageEntity', 'agent')
	languages?: AgentLanguageEntity[]

	/**
	 * One-to-Many relationship with ContactMethod.
	 * Agent's phone numbers, emails, and other contact methods.
	 * @public
	 */
	@OneToMany('ContactMethodEntity', 'agent')
	contactMethods?: ContactMethodEntity[]

	/**
	 * One-to-One relationship with PaymentSettings.
	 * Agent's payment configuration (cap reset, split check).
	 * @public
	 */
	@OneToOne('PaymentSettingsEntity', 'agent')
	paymentSettings?: PaymentSettingsEntity

	/**
	 * One-to-One relationship with SponsorConfiguration.
	 * Agent's sponsor buffer settings.
	 * @public
	 */
	@OneToOne('SponsorConfigurationEntity', 'agent')
	sponsorConfiguration?: SponsorConfigurationEntity

	/**
	 * One-to-Many relationship with ActiveLocation.
	 * Agent's active service locations.
	 * @public
	 */
	@OneToMany('ActiveLocationEntity', 'agent')
	activeLocations?: ActiveLocationEntity[]

	/**
	 * One-to-Many relationship with Relationship (as subject).
	 * Relationships where this agent is the subject (sponsor, mentor).
	 * @public
	 */
	@OneToMany('RelationshipEntity', 'subjectAgent')
	subjectRelationships?: RelationshipEntity[]

	/**
	 * One-to-Many relationship with Relationship (as object).
	 * Relationships where this agent is the object (sponsored, mentored).
	 * @public
	 */
	@OneToMany('RelationshipEntity', 'objectAgent')
	objectRelationships?: RelationshipEntity[]

	/**
	 * One-to-One relationship with PublicProfile.
	 * Agent's publicly visible profile information.
	 * @public
	 */
	@OneToOne('PublicProfileEntity', 'agent')
	publicProfile?: PublicProfileEntity
}
