import { EnvelopeService } from './envelope.service.js';
import { HmacService } from './hmac.service.js';
import { extractLastFour } from '../utils/last4.js';
import type { EncryptedFieldResult } from '../types/encrypted-field.types.js';
import type { EncryptionContext } from '../types/encryption-context.types.js';

/**
 * Field-level encryption orchestrator.
 *
 * This is the primary public API for @trupryce/encryption. It composes:
 * - EnvelopeService (AES-256-GCM via AWS KMS)
 * - HmacService (blind index generation)
 * - last4 utility (masked display values)
 *
 * into a single `encryptField()` / `decryptField()` interface.
 *
 * Usage:
 * ```typescript
 * import { createFieldEncryptionService } from '@trupryce/encryption';
 *
 * const encryption = createFieldEncryptionService({
 *   kms: { keyArn: 'alias/trupryce-pii', region: 'us-east-1' },
 *   hmac: { currentSecret: process.env.HMAC_SECRET },
 * });
 *
 * const result = await encryption.encryptField('123-45-6789', {
 *   tableName: 'agent_taxes',
 *   recordId: 'uuid-here',
 *   fieldName: 'type_value',
 * });
 * ```
 */
export class FieldEncryptionService {
  constructor(
    private readonly envelope: EnvelopeService,
    private readonly hmac: HmacService,
  ) {}

  /**
   * Encrypt a sensitive field value and produce all associated database columns.
   *
   * This is the primary write method. It performs three operations:
   * 1. AES-256-GCM envelope encryption (via KMS)
   * 2. HMAC-SHA256 blind index generation
   * 3. Last-4 extraction for masked display
   *
   * @param plaintext - The sensitive value to encrypt (SSN, EIN, account number, etc.)
   * @param context - AAD context binding ciphertext to this specific record
   * @returns Structured result mapping directly to database columns
   */
  async encryptField(
    plaintext: string,
    context: EncryptionContext,
  ): Promise<EncryptedFieldResult> {
    const { ciphertext, keyId } = await this.envelope.encryptValue(plaintext, context);

    const blindIndex = this.hmac.hash(plaintext);
    const lastFour = extractLastFour(plaintext);

    return {
      ciphertext,
      blindIndex,
      lastFour,
      keyId,
      encryptionVersion: 1,
      encryptedAt: new Date(),
    };
  }

  /**
   * Decrypt a previously encrypted field value.
   *
   * @param ciphertext - The encrypted buffer from the database column
   * @param context - Must match the context used during encryption
   * @returns The original plaintext value
   * @throws If encryption context doesn't match (tamper/misuse detection)
   */
  async decryptField(
    ciphertext: Buffer,
    context: EncryptionContext,
  ): Promise<string> {
    return this.envelope.decryptValue(ciphertext, context);
  }

  /**
   * Generate a blind index for lookup without encrypting.
   *
   * Use when you need to search for a record by its plaintext value
   * without performing a full encryption operation.
   *
   * ```typescript
   * const hash = encryption.generateBlindIndex('123-45-6789');
   * const company = await repo.findOne({ where: { tax_id_hashed: hash } });
   * ```
   *
   * @param plaintext - The value to generate a blind index for
   * @returns 64-character HMAC-SHA256 hex string
   */
  generateBlindIndex(plaintext: string): string {
    return this.hmac.hash(plaintext);
  }

  /**
   * Generate blind index hashes for lookup with rotation fallback.
   *
   * Returns multiple hashes when HMAC key rotation is active.
   * Use with SQL IN clause to match records hashed with either key.
   *
   * ```typescript
   * const hashes = encryption.generateBlindIndexWithFallback('123-45-6789');
   * const companies = await repo.find({
   *   where: { tax_id_hashed: In(hashes) },
   * });
   * ```
   *
   * @param plaintext - The value to generate blind indexes for
   * @returns Array of hex strings — typically 1 element, 2 during rotation
   */
  generateBlindIndexWithFallback(plaintext: string): string[] {
    return this.hmac.hashWithFallback(plaintext);
  }

  /**
   * Check if HMAC key rotation is currently active.
   * Useful for migration tooling and health checks.
   */
  isHmacRotationActive(): boolean {
    return this.hmac.isRotationActive();
  }
}