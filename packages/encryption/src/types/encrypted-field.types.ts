/**
 * The result of encrypting a single field value.
 *
 * Contains everything needed to populate the database columns:
 *   - ciphertext    → the encrypted column (bytea)
 *   - blindIndex    → the HMAC column (char(64))
 *   - lastFour      → the display column (char(4))
 *   - keyId         → the encryption_key_id column (varchar)
 *   - encryptedAt   → the encrypted_at column (timestamptz)
 */
export interface EncryptedFieldResult {
  /**
   * The AWS Encryption SDK encrypted message.
   * Contains the encrypted DEK, ciphertext, IV, and auth tag in a single blob.
   * Store as `bytea` in Postgres.
   */
  ciphertext: Buffer;

  /**
   * HMAC-SHA256 hex digest of the plaintext value.
   * Used as a blind index for exact-match lookups without decrypting.
   * Store as `char(64)` in Postgres.
   * Generated using the **current** HMAC key only.
   */
  blindIndex: string;

  /**
   * Last 4 characters of the plaintext (after stripping non-alphanumeric chars).
   * Used for masked display in UIs (e.g., "***-**-6789").
   * Store as `char(4)` in Postgres.
   */
  lastFour: string;

  /**
   * The actual KMS key ARN (with key ID, not alias) extracted from the
   * SDK encrypted message header. Identifies which key version encrypted
   * this data — essential for targeted re-encryption during key rotation.
   * Store as `varchar(255)` in Postgres.
   */
  keyId: string;

  /**
   * Encryption scheme version. Tracks HOW the data was encrypted —
   * algorithm, SDK version, envelope format. If the encryption approach
   * changes in the future, bump this so decrypt logic can branch.
   *
   *   1 = @aws-crypto/client-node v4, AES-256-GCM, REQUIRE_ENCRYPT_REQUIRE_DECRYPT
   *
   * Store as `smallint` in Postgres.
   */
  encryptionVersion: number;

  /** Timestamp when the encryption was performed. */
  encryptedAt: Date;
}