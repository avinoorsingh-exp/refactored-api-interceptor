import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'

// Forward declaration for circular dependency
import type { AgentTaxEntity } from './agent-tax.entity.js'

/**
 * Tax ID type enum values.
 * SSN - Social Security Number (US individuals)
 * GSN_HST - GST/HST Number (Canadian businesses)
 * EIN - Employer Identification Number (US businesses)
 * @public
 */
export type TaxIdType = 'SSN' | 'GSN_HST' | 'EIN'

/**
 * TypeORM entity for Tax table.
 * Stores tax identifier information (SSN, EIN, GSN_HST).
 *
 * Stores HMAC blind index + last4 for display. The BYTEA ciphertext column
 * (type_value) is reserved for Phase 2 KMS encryption and is currently always
 * null — the encryption layer is not yet wired (see ADR-PII-001).
 *
 * @public
 */
@Entity({ name: 'tax', schema: 'core' })
export class TaxEntity extends AuditableEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Type of tax identifier (SSN, GSN_HST, EIN).
	 * @public
	 */
	@Column({ name: 'tax_id_type', type: 'text' })
	@Searchable({ weight: 8, behavior: 'exact', description: 'Tax ID type (SSN, GSN_HST, EIN)' })
	@Filterable()
	@Sortable()
	taxIdType!: TaxIdType

	// ==========================================
	// ENCRYPTED COLUMNS
	// ==========================================

	/**
	 * AES-256-GCM ciphertext of the tax ID type value.
	 * Stores raw encrypted bytes (iv + authTag + ciphertext).
	 * No masking — this is the encrypted blob only.
	 * Nullable until encryption layer is wired up.
	 * @public
	 */
	@Column({ name: 'type_value', type: 'bytea', nullable: true })
	typeValue?: Buffer

	/**
	 * HMAC-SHA256 blind index for equality lookups (64 lowercase hex chars).
	 * Deterministic — same plaintext always produces the same token.
	 * Not reversible — the original value cannot be recovered.
	 * Used for WHERE clauses without decrypting the ciphertext.
	 * @public
	 */
	@Column({ name: 'type_hashed', type: 'char', length: 64, nullable: true })
	typeHashed?: string

	/**
	 * Last 4 digits of the tax ID (display-only, derived on write).
	 * Plain text, never encrypted. Used for masked display (e.g., "*****6789").
	 * @public
	 */
	@Column({ name: 'type_last4', type: 'char', length: 4, nullable: true })
	typeLast4?: string

	/**
	 * Identifier for the DEK/key-version used to encrypt typeValue.
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

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * One-to-Many relationship with AgentTax (junction table).
	 * A tax record can be associated with multiple agents.
	 * @public
	 */
	@OneToMany('AgentTaxEntity', 'tax')
	agentTaxes?: AgentTaxEntity[]
}
