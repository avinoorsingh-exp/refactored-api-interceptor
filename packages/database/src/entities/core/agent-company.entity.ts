import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	OneToMany,
	ManyToMany,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

// Forward declaration for circular dependency
import type { AgentCompanyAssociationEntity } from './agent-company-association.entity.js'

/**
 * TypeORM entity for AgentCompany table.
 * Represents an agent's company/brokerage for commission payments.
 *
 * Stores HMAC blind index + last4 for display. The BYTEA ciphertext column
 * (tax_id) is reserved for Phase 2 KMS encryption and is currently always
 * null — the encryption layer is not yet wired (see ADR-PII-001).
 *
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

	// ==========================================
	// NEW ENCRYPTED COLUMNS
	// ==========================================

	/**
	 * AES-256-GCM ciphertext of the full tax ID value.
	 * Stores raw encrypted bytes (iv + authTag + ciphertext).
	 * No masking — this is the encrypted blob only.
	 * Nullable until backfill populates it for all rows.
	 * @public
	 */
	@Column({ name: 'tax_id', type: 'bytea', nullable: true })
	taxId?: Buffer

	/**
	 * HMAC-SHA256 blind index for equality lookups (64 lowercase hex chars).
	 * Deterministic — same plaintext always produces the same token.
	 * Not reversible — the original value cannot be recovered.
	 * Used for WHERE clauses without decrypting the ciphertext.
	 * Nullable until backfill populates it for all rows.
	 * @public
	 */
	@Column({ name: 'tax_id_hashed', type: 'char', length: 64, nullable: true })
	taxIdHashed?: string

	/**
	 * Last 4 digits of the tax ID (display-only, derived on write).
	 * Plain text, never encrypted. Used for masked display (e.g., "*****6789").
	 * Nullable until backfill populates it for all rows.
	 * @public
	 */
	@Column({ name: 'tax_id_last4', type: 'char', length: 4, nullable: true })
	taxIdLast4?: string

	/**
	 * Identifier for the DEK/key-version used to encrypt taxId.
	 * This is NOT the key itself — it references a key ID in the key management system
	 * (e.g., AWS KMS key ARN, vault path, or internal key-id).
	 * Used for key rotation: tells the decryption layer which key to use.
	 * VARCHAR(256) accommodates AWS KMS ARNs (~200 chars) and similar identifiers.
	 * @public
	 */
	@Column({ name: 'encryption_key_id', type: 'varchar', length: 256, nullable: true })
	encryptionKeyId?: string

	/**
	 * Encryption scheme version. Tracks HOW the data was encrypted —
	 * algorithm, SDK version, envelope format. Allows the decrypt layer to
	 * branch on version if the approach changes in the future.
	 *
	 *   0 = Mendix AES-128-CBC (legacy migrated rows — see ADR-PII-002)
	 *   1 = @aws-crypto/client-node v4, AES-256-GCM, REQUIRE_ENCRYPT_REQUIRE_DECRYPT
	 *
	 * Nullable — only populated when encryption is applied.
	 * @public
	 */
	@Column({ name: 'encryption_version', type: 'smallint', nullable: true })
	encryptionVersion?: number

	/**
	 * Timestamp of when the value was encrypted (or re-encrypted during key rotation).
	 * Nullable — only populated when encryption is applied.
	 * @public
	 */
	@Column({ name: 'encrypted_at', type: 'timestamptz', nullable: true })
	encryptedAt?: Date

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
