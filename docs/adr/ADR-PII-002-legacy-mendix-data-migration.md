# ADR-PII-002: Legacy Mendix Encrypted Data Migration Strategy

## Status

**Proposed** — February 2026 (no decision yet)

## Context

### Source System

The legacy Mendix platform stores tax IDs (SSN, EIN, GST/HST) for agents and agent companies using Mendix's built-in encryption module:

- **Algorithm**: AES-128-CBC with PKCS5 padding
- **Stored format**: `{AES3}<base64( IV(16 bytes) || ciphertext )>`
- **Key source**: `Encryption.EncryptionKey` — a shared symmetric key configured in the Mendix runtime
- **No authentication tag** — AES-CBC provides confidentiality only, no tamper detection

### Target System

The new platform uses `@exprealty/encryption` with a versioned encryption scheme tracked via `encryption_version` (SMALLINT):

| Version | Scheme | Description |
|---------|--------|-------------|
| 0 | Mendix AES-128-CBC | Legacy ciphertext migrated as-is |
| 1 | AWS KMS envelope (AES-256-GCM) | `@aws-crypto/client-node` v4, `REQUIRE_ENCRYPT_REQUIRE_DECRYPT` commitment policy |

### Target Columns

Both `core.tax` and `core.agent_company` have identical column sets (with different prefixes — `core.tax` uses `type_value`/`type_hashed`/`type_last4` since `tax_id` is the FK in other tables):

| Column (`core.tax` / `core.agent_company`) | Type | Description |
|---------------------------------------------|------|-------------|
| `type_value` / `tax_id` | BYTEA | Ciphertext (v0: Mendix blob, v1: KMS envelope) |
| `type_hashed` / `tax_id_hashed` | CHAR(64) | HMAC-SHA256 blind index |
| `type_last4` / `tax_id_last4` | CHAR(4) | Last 4 digits for masked display |
| `encryption_key_id` | VARCHAR(256) | Key identifier (v0: empty/null, v1: KMS key ARN) |
| `encryption_version` | SMALLINT | Scheme version (0 or 1) |
| `encrypted_at` | TIMESTAMPTZ | When encryption/migration occurred |

### HMAC Secret Continuity

The same HMAC secret used by the old `TaxIdTokenizer` will be used as `hmac.current` in the new `FieldEncryptionService`. This means:

- Blind indexes computed during Mendix migration (`encryption_version = 0`) are identical to those computed by the service layer (`encryption_version = 1`)
- `tax_id_hashed` lookups work seamlessly across both versions
- No HMAC key rotation is needed at migration time

### Key Uncertainty

**The Mendix-encrypted data may not be decryptable.** Possible failure modes:

1. The Mendix `Encryption.EncryptionKey` is unavailable, lost, or was rotated without preserving old keys
2. The key derivation method varies by Mendix version — if the exact version is unknown, the derived AES key may be wrong
3. Some rows may contain plaintext (no `{AES3}` prefix) if encryption was added after initial data entry
4. Some rows may contain corrupt or truncated ciphertext
5. The encryption module configuration may differ between Mendix environments (dev/staging/prod)

## Options Under Consideration

### Option A: Best-Effort Migration

During migration, attempt to decrypt each row:

- **Success**: Populate all 5 encrypted columns + `encryption_version = 0`. The `tax_id` column stores the original Mendix ciphertext blob.
- **Failure**: Store `NULL` in all encrypted columns. These records will require the user to re-enter their tax ID through the application.

```
For each row:
  1. Read legacy value from Mendix DB
  2. If no {AES3} prefix → treat as plaintext, compute HMAC + last4, encrypt with KMS (version 1)
  3. If {AES3} prefix → attempt Mendix decrypt:
     a. Success → compute HMAC + last4, store Mendix ciphertext as-is (version 0)
     b. Failure → log error, store NULLs, flag for re-collection
```

**Pros**: Preserves whatever data we can; clean tracking via `encryption_version`
**Cons**: Some rows will have null tax IDs; need UI workflow to re-collect

### Option B: Decrypt and Re-Encrypt All

Attempt Mendix decrypt → if successful, re-encrypt with KMS as version 1. No version-0 data in production.

**Pros**: Clean; only one decrypt code path in the service layer
**Cons**: Requires KMS infrastructure during migration; slower; same failure modes for undecryptable rows

### Option C: Skip Ciphertext, Migrate Only Derived Fields

Don't migrate `tax_id` (ciphertext) at all. Only compute `tax_id_hashed` and `tax_id_last4` from decrypted plaintext. Users must re-enter their full tax ID for it to be encrypted.

**Pros**: No legacy ciphertext in the new system; simplest decrypt path
**Cons**: All users must re-enter tax IDs; blind index requires successful decryption anyway

### Option D: Store Mendix Ciphertext, Defer Decryption

Store the raw Mendix `{AES3}` blob in `tax_id` as version 0 without attempting to decrypt during migration. Compute `tax_id_hashed` and `tax_id_last4` only if decryption succeeds; otherwise leave them null too.

**Pros**: Fastest migration; no decryption failures block the migration
**Cons**: Version 0 rows without HMAC/last4 are not searchable or displayable

## Migration Script Requirements (Any Option)

1. The Mendix `Encryption.EncryptionKey` must be available to the migration runtime
2. Must handle mixed data: `{AES3}`-prefixed values, plaintext values, nulls, empty strings
3. Must log per-row success/failure for audit
4. Must be idempotent (safe to re-run)
5. Must operate within a transaction per batch (not per row, for performance)
6. Must track which rows were successfully migrated vs. flagged for re-collection

## Decision

**Pending.** Awaiting:

1. Confirmation that the Mendix `Encryption.EncryptionKey` is available and the correct key derivation method is known
2. Test migration run against a sample dataset to determine the decryption success rate
3. If decryption success rate is < 100%, a product decision on the re-collection workflow

## Consequences (to be updated after decision)

- TBD
