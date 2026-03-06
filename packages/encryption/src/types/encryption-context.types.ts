/**
 * Additional Authenticated Data (AAD) context.
 *
 * Binds the ciphertext to a specific record. If someone copies encrypted data
 * from one row to another, decryption will fail because the context won't match.
 *
 * This is passed to the AWS Encryption SDK as the `encryptionContext` which is
 * included in the encrypted message header (not encrypted, but authenticated).
 */
export interface EncryptionContext {
  /** Tenant isolation — optional, for multi-tenant deployments */
  tenantId?: string;

  /** The table this encrypted value belongs to (e.g., 'agent_companies') */
  tableName: string;

  /** The primary key / identifier of the row (e.g., UUID) */
  recordId: string;

  /** The column name being encrypted (e.g., 'tax_id') */
  fieldName: string;
}

/**
 * Converts our typed context into the Record<string, string> that the
 * AWS Encryption SDK expects for encryptionContext.
 */
export function toSdkEncryptionContext(
  ctx: EncryptionContext,
): Record<string, string> {
  const sdkContext: Record<string, string> = {
    tableName: ctx.tableName,
    recordId: ctx.recordId,
    fieldName: ctx.fieldName,
  };

  if (ctx.tenantId) {
    sdkContext.tenantId = ctx.tenantId;
  }

  return sdkContext;
}