import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, OneToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm'
import { AddressEntity } from './address.entity.js'
import { AuditableEntity } from './auditable.entity.js'
import { MLSEntity } from './mls.entity.js'
import { OfficeEntity } from './office.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

// Forward declarations for circular dependencies
import type { AgentOfficeEntity } from './agent-office.entity.js'
import type { AgentCompanyAssociationEntity } from './agent-company-association.entity.js'
import type { AgentTaxEntity } from './agent-tax.entity.js'
import type { AgentNoteEntity } from './agent-note.entity.js'
import type { TaxEntity } from './tax.entity.js'

import type { AgentAddressEntity } from './agent-address.entity.js'
import type { AgentExternalReferenceEntity } from './agent-external-reference.entity.js'
import type { AgentLanguageEntity } from './agent-language.entity.js'
import type { ContactMethodEntity } from './contact-method.entity.js'
import type { PaymentSettingsEntity } from './payment-settings.entity.js'
import type { SponsorConfigurationEntity } from './sponsor-configuration.entity.js'
import type { ActiveLocationEntity } from './active-location.entity.js'
import type { RelationshipEntity } from './relationship.entity.js'
import type { PublicProfileEntity } from './public-profile.entity.js'
import type { LicenseEntity } from './license.entity.js'
import { AgentCompanyEntity } from './agent-company.entity.js'

/**
 * Agent title enum values.
 * @public
 */
export type AgentTitle = 'Mr' | 'Mrs' | 'Ms' | 'Miss'

/**
 * Agent lifecycle status enum values (PascalCase).
 * Matches migration data format.
 * @public
 */
export type AgentLifecycleStatus =
	| 'Joining'
	| 'Active'
	| 'InActive'
	| 'Vested'
	| 'VestedRetired'
	| 'LeadOnly'

/**
 * TypeORM entity for Agent table.
 * Database representation of the domain Agent type.
 * @public
 */
@Entity({ name: 'agent', schema: 'core' })
export class AgentEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * Not searchable - users search by name/agentId, not UUID.
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Auto-generated agent ID (BigInt).
	 * If not provided during INSERT, a sequence generates the value.
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'bigint' })
	@Searchable({ type: 'integer', weight: 4, behavior: 'exact', description: 'Auto-generated agent ID (bigint)', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	agentId!: string

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
	 * Defaults to 'Joining' for new agents.
	 * @public
	 */
	@Column({ name: 'lifecycle_status', type: 'text', default: 'Joining' })
	@Searchable({ weight: 7, behavior: 'exact', description: 'Agent lifecycle status (Joining, Active, InActive, Vested, VestedRetired, LeadOnly)' })
	@Filterable()
	@Sortable()
	lifecycleStatus!: AgentLifecycleStatus

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

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * One-to-Many relationship with AgentCompanyAssociation (junction table).
	 * An agent can be associated with multiple companies.
	 * Use this to access junction metadata like isPrimary.
	 * @public
	 */
	@OneToMany('AgentCompanyAssociationEntity', 'agent')
	agentCompanyAssociations?: AgentCompanyAssociationEntity[]

	/**
	 * Virtual property for primary agent company.
	 * Loaded via custom query when include=primaryAgentCompany is specified.
	 * @see AgentRepository.loadPrimaryAgentCompany()
	 */
	primaryAgentCompany?: AgentCompanyEntity

	/**
	 * Many-to-Many relationship with AgentCompany.
	 * Direct access to companies (hides junction table).
	 * TypeORM handles agent_company_association join table transparently.
	 * @public
	 */
	@ManyToMany(() => AgentCompanyEntity, (company) => company.agents)
	@JoinTable({
		name: 'agent_company_association',
		schema: 'core',
		joinColumn: {
			name: 'agent_id',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'agent_company_id',
			referencedColumnName: 'id',
		},
	})
	agentCompany?: AgentCompanyEntity[]

	/**
	 * One-to-Many relationship with AgentOffice (junction table).
	 * Use this to access junction metadata like isPrimary.
	 * @public
	 */
	@OneToMany('AgentOfficeEntity', 'agent')
	agentOffice?: AgentOfficeEntity[]

	/**
	 * One-to-Many relationship with AgentTax (junction table).
	 * An agent can have multiple tax identifiers.
	 * Use this to access junction metadata like isPrimary.
	 * @public
	 */
	@OneToMany('AgentTaxEntity', 'agent')
	agentTaxes?: AgentTaxEntity[]

	/**
	 * Many-to-Many relationship with Tax.
	 * Direct access to taxes (hides junction table).
	 * TypeORM handles agent_tax join table transparently.
	 * @public
	 */
	@ManyToMany('TaxEntity')
	@JoinTable({
		name: 'agent_tax',
		schema: 'core',
		joinColumn: {
			name: 'agent_id',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'tax_id',
			referencedColumnName: 'id',
		},
	})
	tax?: TaxEntity[]

	/**
	 * Virtual property for primary tax identifier.
	 * Loaded via custom query when include=primaryTax is specified.
	 * @see AgentRepository.loadPrimaryTax()
	 */
	primaryTax?: TaxEntity

	/**
	 * Many-to-Many relationship with Office.
	 * Direct access to offices (hides junction table).
	 * TypeORM handles agent_office join table transparently.
	 * @public
	 */
	@ManyToMany(() => OfficeEntity, (office) => office.agents)
	@JoinTable({
		name: 'agent_office',
		schema: 'core',
		joinColumn: {
			name: 'agent_id',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'office_id',
			referencedColumnName: 'id',
		},
	})
	office?: OfficeEntity[]

	/**
	 * Many-to-Many relationship with MLS.
	 * TypeORM handles agent_mls join table transparently.
	 * Uses agent.id (UUID) as the join column.
	 * @public
	 */
	@ManyToMany(() => MLSEntity, (mls) => mls.agents)
	@JoinTable({
		name: 'agent_mls',
		schema: 'core',
		joinColumn: {
			name: 'agent_id',
			referencedColumnName: 'id', // References Agent.id (UUID primary key)
		},
		inverseJoinColumn: {
			name: 'mls_id',
			referencedColumnName: 'id', // References MLS.id (bigint primary key)
		},
	})
	mls?: MLSEntity[];

	/**
	 * Many-to-Many relationship with Address.
	 * TypeORM handles agent_address join table transparently.
	 * Uses agent.id (UUID) and address.id (BigInt) as join columns.
	 * For include=address - hides junction table like MLS.
	 * @public
	 */
	@ManyToMany(() => AddressEntity)
	@JoinTable({
		name: 'agent_address',
		schema: 'core',
		joinColumn: {
			name: 'agent_id',
			referencedColumnName: 'id', // References Agent.id (UUID primary key)
		},
		inverseJoinColumn: {
			name: 'address_id',
			referencedColumnName: 'id', // References Address.id (BigInt primary key)
		},
	})
	addresses?: AddressEntity[];

	/**
	 * One-to-Many relationship with AgentAddress (junction table).
	 * Use this when you need junction metadata like isPrimary.
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

	/**
	 * One-to-Many relationship with License.
	 * Agent's professional licenses.
	 * @public
	 */
	@OneToMany('LicenseEntity', 'agent')
	licenses?: LicenseEntity[]

	/**
	 * One-to-Many relationship with AgentNote (junction table).
	 * An agent can have multiple notes.
	 * @public
	 */
	@OneToMany('AgentNoteEntity', 'agent')
	agentNotes?: AgentNoteEntity[]

	/**
	 * Primary email contact method
	 * 
	 * Virtual property - loaded via custom query
	 * Use ?includes=primaryEmail to load
	 * Sortable/filterable via projection config
	 * 
	 * @see AgentRepository.loadPrimaryContacts()
	 * @see AGENT_PROJECTION_CONFIG.relations.primaryEmail
	 */
	primaryEmail?: ContactMethodEntity;

  	/**
	 * Primary phone contact method
	 * 
	 * Virtual property - loaded via custom query
	 * Use ?includes=primaryPhone to load
	 * Sortable/filterable via projection config
	 * 
	 * @see AgentRepository.loadPrimaryContacts()
	 * @see AGENT_PROJECTION_CONFIG.relations.primaryPhone
	 */
	primaryPhone?: ContactMethodEntity;

	/**
	 * Primary address for the agent
	 * 
	 * Virtual property - loaded via custom query
	 * Use ?include=primaryAddress to load
	 * Returns the AddressEntity directly (like primaryEmail)
	 * 
	 * @see AgentRepository.loadPrimaryAddress()
	 * @see AGENT_PROJECTION_CONFIG.relations.primaryAddress
	 */
	primaryAddress?: AddressEntity;

	/**
	 * Primary license for the agent
	 * 
	 * Virtual property - loaded via custom query
	 * Use ?include=primaryLicense to load
	 * Returns the LicenseEntity with isPrimary = true
	 * 
	 * @see AgentRepository.loadPrimaryLicense()
	 * @see AGENT_PROJECTION_CONFIG.relations.primaryLicense
	 */
	primaryLicense?: LicenseEntity;

	/**
	 * Licensed states for the agent (array of state abbreviations)
	 * 
	 * Virtual property - loaded via custom subquery
	 * Use ?include=licensedStates to load
	 * Returns array of unique state codes where agent holds licenses
	 * 
	 * @see AgentRepository.loadLicensedStates()
	 * @see AGENT_PROJECTION_CONFIG.relations.licensedStates
	 */
	licensedStates?: string[];

    // ========================================
	// Helper Methods
	// ========================================

	/**
	 * Get primary contact method by type
	 * 
	 * Use after loading contactMethods relation
	 */
	getPrimaryContactByType(type: string): ContactMethodEntity | undefined {
		return this.contactMethods?.find(
		(c) => c.channel === type && c.isPrimary,
		);
	}

	/**
	 * Get email address for primary email
	 */
	getPrimaryEmailAddress(): string | undefined {
		return this.primaryEmail?.value;
	}

	/**
	 * Get phone number for primary phone
	 */
	getPrimaryPhoneNumber(): string | undefined {
		return this.primaryPhone?.value;
	}
}
