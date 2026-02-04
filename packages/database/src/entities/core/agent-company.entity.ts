import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	OneToMany,
	ManyToMany,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'
import { createEncryptedTransformer, createWriteOnlyEncryptedTransformer } from '@exprealty/encryption'

// Forward declaration for circular dependency
import type { AgentCompanyAssociationEntity } from './agent-company-association.entity.js'

/**
 * Environment variable for encryption key.
 * Falls back to a development-only key if not set.
 * IMPORTANT: Always set ENCRYPTION_KEY in production!
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'dev-only-encryption-key-32chars!'

/**
 * TypeORM entity for AgentCompany table.
 * Represents an agent's company/brokerage for commission payments.
 * Database representation of the domain AgentCompany type.
 * @public
 */
@Entity({ name: 'agent_company', schema: 'core' })
export class AgentCompanyEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Legacy system ID for migration compatibility (BigInt).
	 * @public
	 */
	@Column({ name: 'legacy_id', type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Legacy system identifier', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	legacyId!: string

	/**
	 * Company email address.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Company email address' })
	@Filterable()
	@Sortable()
	email!: string

	/**
	 * Registered/legal name of the brokerage.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Company/brokerage name' })
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * Company phone number.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 5, behavior: 'partial', description: 'Company phone number' })
	@Filterable()
	phone!: string

	/**
	 * Tax ID (AES encrypted, masked on read - shows last 4 digits).
	 * Stored encrypted in database, displayed as "*****6789" format.
	 * @public
	 */
	@Column({
		name: 'tax_id',
		type: 'text',
		nullable: true,
		transformer: createEncryptedTransformer({
			key: ENCRYPTION_KEY,
			maskOnRead: true,
			visibleChars: 4,
		}),
	})
	taxId?: string

	/**
	 * Hashed tax ID for secure lookups (AES encrypted, write-only).
	 * Used for searching/matching without exposing the actual value.
	 * @public
	 */
	@Column({
		name: 'tax_id_hashed',
		type: 'text',
		nullable: true,
		transformer: createWriteOnlyEncryptedTransformer({ key: ENCRYPTION_KEY }),
	})
	taxIdHashed?: string

	/**
	 * Whether to use SSN instead of EIN.
	 * @public
	 */
	@Column({ name: 'use_ssn', type: 'boolean', default: false })
	@Filterable()
	useSsn!: boolean

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * One-to-Many relationship with AgentCompanyAssociation (junction table).
	 * Provides access to agents associated with this company.
	 * @public
	 */
	@OneToMany('AgentCompanyAssociationEntity', 'agentCompany')
	agentAssociations?: AgentCompanyAssociationEntity[]

	/**
	 * Many-to-Many relationship with Agent.
	 * Direct access to agents (hides junction table).
	 * Inverse of Agent.agentCompany.
	 * @public
	 */
	@ManyToMany('AgentEntity', 'agentCompany')
	agents?: import('./agent.entity.js').AgentEntity[]
}
