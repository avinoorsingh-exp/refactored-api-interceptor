import { EncryptedFieldResult } from '../types/encrypted-field.types.js';

/**
 * Column mapping result — keys are column names, values are column values.
 *
 * Designed for direct assignment to entities or raw SQL parameter objects.
 */
export type ColumnMap = Record<string, Buffer | string | number | Date>;

/**
 * Map an EncryptedFieldResult to database column names using a prefix.
 *
 * Given prefix "tax_id", produces:
 * ```
 * {
 *   tax_id:                Buffer,    // ciphertext (bytea)
 *   tax_id_hashed:         string,    // blind index (char(64))
 *   tax_id_last4:          string,    // masked display (char(4))
 *   encryption_key_id:     string,    // KMS key identifier
 *   encryption_version:    number,    // scheme version (smallint)
 *   encrypted_at:          Date,      // encryption timestamp
 * }
 * ```
 *
 * Usage with TypeORM entities:
 * ```typescript
 * const encrypted = await encryption.encryptField(taxId, context);
 * Object.assign(company, mapEncryptedFieldToColumns(encrypted, 'tax_id'));
 * ```
 *
 * Usage with raw SQL:
 * ```typescript
 * const columns = mapEncryptedFieldToColumns(encrypted, 'account_number');
 * await db.query(
 *   `UPDATE agent_bank_accounts SET
 *     account_number = $1, account_number_hashed = $2, account_number_last4 = $3,
 *     encryption_key_id = $4, encryption_version = $5, encrypted_at = $6
 *    WHERE id = $6`,
 *   [...Object.values(columns), recordId]
 * );
 * ```
 *
 * @param result - The encrypted field result from `encryptField()`
 * @param prefix - Column name prefix (e.g., 'tax_id', 'account_number', 'type_value')
 * @returns Object with column names as keys
 */
export function mapEncryptedFieldToColumns(
  result: EncryptedFieldResult,
  prefix: string,
): ColumnMap {
  return {
    [prefix]: result.ciphertext,
    [`${prefix}_hashed`]: result.blindIndex,
    [`${prefix}_last4`]: result.lastFour,
    encryption_key_id: result.keyId,
    encryption_version: result.encryptionVersion,
    encrypted_at: result.encryptedAt,
  };
}