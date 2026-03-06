# ADR-PII-002: Legacy Mendix Encrypted Data Migration Strategy

## Status

**Schema Implemented / Migration Decision Pending** — February 2026

> The target entity schema is fully implemented (`core.tax`, `core.agent_company`).
> The decision of which migration option to execute (A–D) is still **pending** — awaiting Mendix key confirmation and a test decryption run.

---

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
| `0` | Mendix AES-128-CBC | Mendix app writes raw `{AES3}<base64(IV\|\|ciphertext)>` blob into the BYTEA column. Decrypted on demand using per-entity service-layer logic (not inside `@exprealty/encryption`). |
| `1` | AWS KMS envelope (AES-256-GCM) | `@aws-crypto/client-node` v4, `REQUIRE_ENCRYPT_REQUIRE_DECRYPT` commitment policy |

**Single-key architecture:** `HMAC_SECRET` serves as both the HMAC blind index key and the Mendix AES-128-CBC passphrase (key derived via MD5). There is no separate Mendix key variable. This guarantees HMAC blind indexes computed by the Mendix migration are identical to those computed by this service — no re-tokenisation is needed.

> **Note:** Both `TaxEntity` and `AgentCompanyEntity` currently document only version `1` in their `encryptionVersion` column comments. Version `0` must be added (see `tasks.md` P2-2).

### Target Columns (implemented)

Both `core.tax` and `core.agent_company` have identical column sets (with different prefixes — `core.tax` uses `type_value`/`type_hashed`/`type_last4` since `tax_id` is the FK in other tables):

| Column (`core.tax` / `core.agent_company`) | Type | Description |
|---------------------------------------------|------|-------------|
| `type_value` / `tax_id` | BYTEA | Ciphertext (v0: Mendix blob, v1: KMS envelope). **Currently null** in service-written rows. |
| `type_hashed` / `tax_id_hashed` | CHAR(64) | HMAC-SHA256 blind index — **populated by current service layer** |
| `type_last4` / `tax_id_last4` | CHAR(4) | Last 4 digits for masked display — **populated by current service layer** |
| `encryption_key_id` | VARCHAR(256) | Key identifier (v0: empty/null, v1: KMS key ARN) |
| `encryption_version` | SMALLINT | Scheme version (`0` or `1`). Null for service-written rows (no ciphertext yet). |
| `encrypted_at` | TIMESTAMPTZ | When encryption/migration occurred. Null for service-written rows. |

### HMAC Secret Continuity

The service layer uses the `TaxIdHasher` port (backed by `HmacService` from `@exprealty/encryption`) to compute blind indexes. The same `HMAC_SECRET` value used by the current service must be the `hmac.current` value used by the Mendix migration. Because the same underlying key is used for both:

- Blind indexes written by the Mendix app during migration are identical to those computed by this service.
- `type_hashed` / `tax_id_hashed` lookups work seamlessly across version-0 and version-1 rows.
- No HMAC re-tokenisation is needed at migration time.

HMAC continuity must be verified against dev data before Phase 4 work completes (see `tasks.md` P5-1).

### Key Uncertainty

**The Mendix-encrypted data may not be decryptable.** Possible failure modes:

1. The Mendix `Encryption.EncryptionKey` is unavailable, lost, or was rotated without preserving old keys.
2. The key derivation method varies by Mendix version — if the exact version is unknown, the derived AES key may be wrong.
3. Some rows may contain plaintext (no `{AES3}` prefix) if encryption was added after initial data entry.
4. Some rows may contain corrupt or truncated ciphertext.
5. The encryption module configuration may differ between Mendix environments (dev/staging/prod).

---

## Migration Approach

**The Mendix app handles the migration.** There is no custom migration script in this codebase. The Mendix application:
1. Reads its own AES-128-CBC encrypted data internally.
2. Writes the raw `{AES3}<base64>` ciphertext blob directly into the BYTEA column with `encryption_version = 0`.
3. Computes and writes `type_hashed` / `tax_id_hashed` using the shared `HMAC_SECRET`.
4. Writes `type_last4` / `tax_id_last4`.

This service reads version-0 rows using per-entity `decryptV0()` logic in each repository. Version-0 rows are lazily re-encrypted to version-1 over time (see ADR-PII-001 Phase 5).

---

## Historical Options (No Longer Active)

The following options were considered before the migration architecture was finalized. Kept for reference.

### Option A: Best-Effort Migration

During migration, attempt to decrypt each row:

- **Success**: Populate all encrypted columns + `encryption_version = 0`. The BYTEA column stores the original Mendix ciphertext blob.
- **Failure**: Store `NULL` in all encrypted columns. These records require the user to re-enter their tax ID through the application.

```
For each row:
  1. Read legacy value from Mendix DB
  2. If no {AES3} prefix → treat as plaintext, compute HMAC + last4, encrypt with KMS (version 1)
  3. If {AES3} prefix → attempt Mendix decrypt:
     a. Success → compute HMAC + last4 + store Mendix ciphertext (version 0)
     b. Failure → log error, store NULLs, flag for re-collection
```

**Pros**: Preserves whatever data we can; clean tracking via `encryption_version`
**Cons**: Some rows will have null tax IDs; need UI workflow to re-collect

### Option B: Decrypt and Re-Encrypt All

Attempt Mendix decrypt → if successful, re-encrypt with KMS as version 1. No version-0 data in production.

**Pros**: Clean; only one decrypt code path in the service layer
**Cons**: Requires KMS infrastructure during migration; slower; same failure modes for undecryptable rows

### Option C: Skip Ciphertext, Migrate Only Derived Fields

Don't migrate the BYTEA ciphertext column at all. Only compute `type_hashed` and `type_last4` from decrypted plaintext. Users must re-enter their full tax ID for the ciphertext to be populated.

**Pros**: No legacy ciphertext in the new system; simplest decrypt path; consistent with current service-written rows (which also have null BYTEA)
**Cons**: All users must re-enter tax IDs to get recovery ciphertext; blind index still requires successful Mendix decryption

### Option D: Store Mendix Ciphertext, Defer Decryption

Store the raw Mendix `{AES3}` blob in the BYTEA column as version 0 without computing HMAC/last4 (only if decryption fails). If decryption succeeds, populate all columns. If not, store only the raw blob.

**Pros**: Fastest migration; preserves encrypted blob even when decryption key is unavailable
**Cons**: Version-0 rows without HMAC/last4 are not searchable or displayable; service layer must handle the null HMAC case

---

## Migration Script Requirements (Any Option)

1. The Mendix `Encryption.EncryptionKey` must be available to the migration runtime.
2. Must handle mixed data: `{AES3}`-prefixed values, plaintext values, nulls, empty strings.
3. Must log per-row success/failure for audit.
4. Must be idempotent (safe to re-run). Check `encryption_version IS NOT NULL` to skip already-migrated rows.
5. Must operate within a transaction per batch (not per row, for performance).
6. Must track which rows were successfully migrated vs. flagged for re-collection.
7. HMAC computation must use the same `HMAC_SECRET` as the running service.

---

## Decision

**Pending.** Awaiting:

1. Confirmation that the Mendix `Encryption.EncryptionKey` is available and the correct key derivation method is known.
2. Test migration run against a sample dataset to determine the decryption success rate.
3. If decryption success rate is < 100%, a product decision on the re-collection workflow.

---

## Consequences (to be updated after decision)

- TBD

---

## References

- ADR-PII-001: Tax ID Storage Model and Encryption Adapter
- `packages/database/src/entities/core/tax.entity.ts`
- `packages/database/src/entities/core/agent-company.entity.ts`
- `packages/encryption/src/services/hmac.service.ts`
- `packages/encryption/src/services/field-encryption.service.ts`
