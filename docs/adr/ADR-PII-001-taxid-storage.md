# ADR-PII-001: Tax ID Storage Model and Encryption Adapter

## Status

**Accepted / Implemented** — February 2026

> **Schema layer:** Complete. Both `core.tax` and `core.agent_company` have the full 6-column encrypted storage layout (BYTEA ciphertext + HMAC blind index + last4 + key metadata). **No schema migrations were required** — all columns were provisioned in advance.
>
> **Service layer:** Fully wired. `FieldEncryptionService` is integrated into both `AgentCompanyService` and `AgentTaxService` via a global `SharedEncryptionModule`. All six columns (BYTEA ciphertext, HMAC blind index, last4, key ID, version, timestamp) are populated on every create/update. Version-aware decryption dispatches to Mendix v0 or KMS v1 based on `encryption_version`.
>
> **Implementation phases completed:** P4-1 (config), P4-2 (SharedEncryptionModule), P4-3/P4-4 (encrypt wiring + UUID pre-gen), P4-5 (version-aware decrypt), P4-6 (startup health log). See ADR-PII-003 for wiring architecture details.

---

## Context

The platform stores tax identifiers (SSN, EIN, GST/HST) for agents and agent companies. These are high-sensitivity PII subject to regulatory requirements (IRS Publication 1075, SOC 2, PCI-DSS adjacency). We need a storage model that:

1. **Minimises blast radius** — a database breach should not expose full tax IDs.
2. **Supports deterministic lookups** — "does this agent already have an SSN on file?" without decrypting.
3. **Displays partial values** — UI shows `***-**-6789` for identification, never full value.
4. **Supports key rotation** without downtime or data re-encryption.
5. **Provides a stable port interface** that hides cryptographic implementation details and can evolve (e.g., enable full KMS envelope encryption) without changing consumers.

### Prior state

The `@exprealty/encryption` package previously used AES-256-GCM with a random IV and scrypt-derived key. This meant:

- Every encryption of the same plaintext produced a different ciphertext (non-deterministic).
- The `value_hashed` column used `createWriteOnlyEncryptedTransformer()` which encrypted with a random IV. Despite its name, it did **not** hash — it could not be used for equality lookups.
- The `value` column used `createEncryptedTransformer({ maskOnRead: true })` which decrypted at read time. The **full ciphertext** of the tax ID was stored in the database.

### Affected entities

| Entity | Column | Prior behaviour | Problem |
|--------|--------|-----------------|---------|
| `core.tax` | `value` | AES-256-GCM ciphertext (full tax ID) | Full PII in DB; breach = full exposure |
| `core.tax` | `value_hashed` | AES-256-GCM ciphertext (random IV) | Cannot be used for lookups; mislabelled |
| `core.agent_company` | `tax_id` | AES-256-GCM ciphertext (full tax ID) | Same as above |
| `core.agent_company` | `tax_id_hashed` | AES-256-GCM ciphertext (random IV) | Same as above |

---

## Decision

### 1. Storage model: three-column layout (implemented)

Each entity now stores tax data across three dedicated columns plus three key-management columns:

| Column | DB type | Content |
|--------|---------|---------|
| `tax_id` / `type_value` | `BYTEA`, nullable | AES-256-GCM KMS envelope ciphertext of the full tax ID. **Populated on every create/update** via `FieldEncryptionService.encryptField()`. |
| `tax_id_hashed` / `type_hashed` | `CHAR(64)`, nullable | Deterministic HMAC-SHA256 blind index (hex). Written by current service layer. |
| `tax_id_last4` / `type_last4` | `CHAR(4)`, nullable | Last 4 characters of the tax ID, stored in cleartext for masked display. Written by current service layer. |
| `encryption_key_id` | `VARCHAR(256)`, nullable | KMS key ARN or key identifier used to encrypt the BYTEA column. |
| `encryption_version` | `SMALLINT`, nullable | Scheme version (see §2 below). |
| `encrypted_at` | `TIMESTAMPTZ`, nullable | When the ciphertext was written or re-encrypted. |

**Rules (in effect):**

- **Never persist masked placeholders** like `*****6789`. Masking is presentation-only, applied at the API response layer. The `isMaskedPlaceholder()` helper in `@exprealty/shared-domain` guards write endpoints.
- `last4` stores exactly the last 4 characters (e.g., `6789`), no mask characters.
- `hashed` stores a deterministic HMAC so that `WHERE tax_id_hashed = hmac(input)` works for duplicate detection.
- The caller submits the full tax ID on create/update. The service encrypts the value via `FieldEncryptionService.encryptField()`, which produces the ciphertext, HMAC blind index, last4, key ID, version, and timestamp in a single call. All six columns are written atomically.

### 2. Encryption version registry

| `encryption_version` | Scheme | SDK / implementation |
|----------------------|--------|----------------------|
| `0` | Mendix AES-128-CBC | Mendix app writes `{AES3}<base64(IV\|\|ciphertext)>` during migration. Decrypted per-entity in the service layer (not via `@exprealty/encryption`). Same underlying key as version 1. |
| `1` | AWS KMS envelope, AES-256-GCM | `@aws-crypto/client-node` v4, `REQUIRE_ENCRYPT_REQUIRE_DECRYPT` commitment policy |

**Single-key architecture:** `HMAC_SECRET` is used for both version 0 (Mendix AES-128-CBC passphrase) and HMAC blind indexing. There is no separate Mendix key — `decryptMendixV0()` derives an AES-128 key from `HMAC_SECRET` via MD5. This ensures HMAC blind indexes computed by the Mendix app during migration are identical to those computed by this service.

### 3. Deterministic token: HMAC-SHA256 (implemented)

```
token = HMAC-SHA256(key = HMAC_SECRET, message = normalize(taxId))
```

- **Normalisation**: `trim()` + `toLower()` only. **Hyphens and spaces are NOT stripped.** `123-45-6789` and `123456789` produce **different tokens**. This is intentional — callers must submit the value in a consistent format.
- **Key**: `HMAC_SECRET` environment variable. Loaded via `@exprealty/config` `EncryptionEnvSchema` and injected through `SharedEncryptionModule` (see §5 and ADR-PII-003).
- **Deterministic**: same input + same key = same output. Enables `WHERE type_hashed = $1` queries.
- **Not reversible**: HMAC output cannot recover the original tax ID.

### 4. `@exprealty/encryption` package — actual API

The `@exprealty/encryption` package exposes **class-based services**, not the functional API described in earlier drafts of this document. The current public surface is:

```typescript
// packages/encryption/src/services/hmac.service.ts
class HmacService {
  constructor(keyring: { current: string; previous?: string })
  hash(plaintext: string): string
  hashWithFallback(plaintext: string): string[]  // returns [current, previous?] for rotation window
}

// packages/encryption/src/services/field-encryption.service.ts
class FieldEncryptionService {
  encryptField(plaintext: string): Promise<EncryptedFieldResult>
  decryptField(result: EncryptedFieldResult): Promise<string>
  generateBlindIndex(plaintext: string): string
  generateBlindIndexWithFallback(plaintext: string): string[]
}

// packages/encryption/src/services/envelope.service.ts
class EnvelopeService {
  encrypt(plaintext: string): Promise<Buffer>
  decrypt(ciphertext: Buffer): Promise<string>
}

// packages/encryption/src/utils/field-mapper.ts
function mapEncryptedFieldToColumns(
  result: EncryptedFieldResult,
  prefix: string   // e.g. 'tax_id' → populates tax_id, tax_id_hashed, tax_id_last4, etc.
): Record<string, unknown>
```

The functional helpers `computeToken`, `verifyToken`, `extractLast`, `mask`, `getTokenKey`, `isTokenKeyConfigured` described in earlier drafts **do not exist** in the codebase.

### 5. Service boundary: `FieldEncryptionService` + `TaxIdHasher` adapter (implemented)

Both `AgentCompanyService` and `AgentTaxService` now depend directly on `FieldEncryptionService` via `@Inject('FIELD_ENCRYPTION')`. This replaced the earlier `TaxIdHasher`-only dependency.

The `TaxIdHasher` port still exists as a thin adapter around `FieldEncryptionService.generateBlindIndex()`, provided by `SharedEncryptionModule` for backward compatibility with any remaining consumers:

```typescript
// services/agent-service/src/common/encryption/shared-encryption.module.ts
{
  provide: 'TaxIdHasher',
  useFactory: (encryption: FieldEncryptionService) => ({
    hash: (plaintext: string) => encryption.generateBlindIndex(plaintext),
    hashWithFallback: (plaintext: string) => encryption.generateBlindIndexWithFallback(plaintext),
  }),
  inject: ['FIELD_ENCRYPTION'],
}
```

> **Previous gaps resolved:**
> - `HMAC_SECRET_PREVIOUS` is now passed to `HmacService` via `SharedEncryptionModule` — rotation fallback (`hashWithFallback`) is end-to-end reachable.
> - The duplicate `taxIdHasherProvider` factory was removed from both feature modules. A single `@Global()` `SharedEncryptionModule` provides all tokens.
> - All config is loaded via `@exprealty/config` `EncryptionEnvSchema`, validated by Zod at startup.

### 6. Token rotation: keyring support (fully wired)

`HmacService` supports a keyring for zero-downtime rotation. Both keys are now wired end-to-end through `SharedEncryptionModule`:

```
HMAC_SECRET=current-key-v2
HMAC_SECRET_PREVIOUS=previous-key-v1   # passed to HmacService, exposed via TaxIdHasher.hashWithFallback()
```

**Rotation procedure:**

1. Generate new key, set as `HMAC_SECRET`. Move old key to `HMAC_SECRET_PREVIOUS`.
2. Deploy. Lookups use both keys. Writes use current key.
3. Run background job to re-hash all rows with current key.
4. After completion, remove `HMAC_SECRET_PREVIOUS`.

### 7. `taxIdToken` in API response (intentional)

The `AgentCompany` domain type includes `taxIdToken` (the HMAC blind index) in its public schema:

```typescript
// packages/shared-domain/src/schemas/agent-company.ts
taxIdToken: z.string().nullable().describe('HMAC-SHA256 token for secure lookups')
```

This is **intentional** — the token allows callers to perform client-side deduplication checks (`WHERE taxIdToken = ?`) without exposing the full tax ID. The HMAC is non-reversible. API callers receive both the masked display value (`*****6789`) and the lookup token.

### 8. Security requirements

| Requirement | Implementation |
|-------------|----------------|
| Key storage | AWS Secrets Manager (prod/staging); `.env` file (local only) |
| Key injection | `@exprealty/config` `EncryptionEnvSchema` → Zod-validated at startup → `ConfigService` → `SharedEncryptionModule` |
| Key separation | `HMAC_SECRET` (HMAC) is separate from KMS data key (AES/KMS via `EnvelopeService`) |
| Least privilege | Only the agent-service IAM role can read the secret |
| Logging | Keys and full tax IDs are **never logged**. Log `last4` or masked value only |
| Dev fallback | Throws at startup if `HMAC_SECRET` is missing (no silent fallback) |
| Transport | All API traffic over TLS. Tax ID plaintext exists only in memory during request |

### 9. Entity column mapping (actual, as implemented)

#### `core.tax` (TaxEntity)

```
+--------------------+-----------+---------------------------------------------+
| DB Column          | Type      | Current Content                             |
+--------------------+-----------+---------------------------------------------+
| id                 | uuid      | PK                                          |
| tax_id_type        | text      | 'SSN' | 'EIN' | 'GSN_HST'                  |
| type_value         | bytea     | AES-256-GCM ciphertext (populated v1, Mendix blob v0) |
| type_hashed        | char(64)  | HMAC-SHA256 blind index (populated)         |
| type_last4         | char(4)   | Last 4 chars (populated)                    |
| encryption_key_id  | varchar   | KMS key ARN (populated for v1)              |
| encryption_version | smallint  | 0=Mendix, 1=KMS (populated)                 |
| encrypted_at       | timestamptz | Encryption timestamp (populated)          |
| created            | tstz      | audit                                       |
| last_modified      | tstz      | audit                                       |
| modified_by        | text      | audit                                       |
| mxid               | bigint    | Legacy Mendix ID (nullable)                 |
+--------------------+-----------+---------------------------------------------+
```

#### `core.agent_company` (AgentCompanyEntity)

```
+--------------------+-----------+---------------------------------------------+
| DB Column          | Type      | Current Content                             |
+--------------------+-----------+---------------------------------------------+
| tax_id             | bytea     | AES-256-GCM ciphertext (populated v1, Mendix blob v0) |
| tax_id_hashed      | char(64)  | HMAC-SHA256 blind index (populated)         |
| tax_id_last4       | char(4)   | Last 4 chars (populated)                    |
| encryption_key_id  | varchar   | KMS key ARN (populated for v1)              |
| encryption_version | smallint  | 0=Mendix, 1=KMS (populated)                 |
| encrypted_at       | timestamptz | Encryption timestamp (populated)          |
| use_ssn            | bool      | Whether to use SSN vs EIN                   |
+--------------------+-----------+---------------------------------------------+
```

---

## Alternatives Considered

### A. Store full AES-256-GCM ciphertext (prior implementation)

- **Pro**: Full value recoverable from the database alone.
- **Con**: Database breach exposes all tax IDs (decrypt with stolen key). Violates data minimisation. Random IV makes lookups impossible. The `value_hashed` column was mislabelled and non-functional.
- **Rejected for MVP**: Unnecessary risk. The originating system of record retains full values.

### B. Deterministic AES (AES-SIV / AES-256-CBC with fixed IV)

- **Pro**: Encrypted and searchable.
- **Con**: Deterministic encryption leaks equality patterns and is vulnerable to frequency analysis on a small domain (SSNs have ~1B values). Adds complexity without meaningful security improvement over HMAC for the lookup use case.
- **Rejected**: HMAC is simpler, non-reversible, and sufficient for duplicate detection.

### C. AWS KMS envelope encryption immediately

- **Pro**: Key never leaves KMS HSM. Supports automatic rotation. Audit trail via CloudTrail.
- **Con**: Adds latency (~5-15ms per call), requires AWS SDK dependency, higher cost, more complex error handling. The entity schema is already KMS-ready; wiring is deferred.
- **Now implemented**: `FieldEncryptionService` and `EnvelopeService` are wired into the service layer via `SharedEncryptionModule`. Local development uses `LocalEnvelopeService` (in-process AES-256-GCM, no KMS) when `NODE_ENV=local`.

### D. Application-level hashing (bcrypt/argon2)

- **Pro**: Proven password-hashing algorithms.
- **Con**: Intentionally slow. Not suitable for high-throughput token computation on every write/lookup. HMAC is fast and deterministic by design.
- **Rejected**: Wrong tool for the job.

---

## Consequences

### Positive

- **Minimised blast radius**: Database stores encrypted ciphertext (BYTEA), irreversible HMAC token, and last4. A database breach without KMS key access cannot recover full tax IDs.
- **Full-value recovery**: BYTEA ciphertext column is now populated on every write. Full tax IDs are recoverable via version-aware decryption (`decryptTaxId` / `decryptTypeValue`).
- **Functional lookups**: Deterministic HMAC enables `WHERE type_hashed = $1` for duplicate detection without decryption.
- **No schema migration required**: All six encryption columns were provisioned in advance. The wiring change is purely service-layer — no database migrations, no downtime.
- **Clean separation**: Masking is presentation-only. No masked placeholders in the database. Decryption is an explicit async call, not automatic on read.
- **Centralised encryption**: Single `@Global()` `SharedEncryptionModule` provides both `FIELD_ENCRYPTION` and `TaxIdHasher` tokens. No duplicate factories.
- **Environment-aware**: `NODE_ENV=local` uses `LocalEnvelopeService` (in-process AES-256-GCM, no KMS). All other environments use real KMS.
- **HMAC rotation end-to-end**: `HMAC_SECRET_PREVIOUS` is fully wired through `SharedEncryptionModule` to `HmacService`.

### Negative

- **KMS latency on writes**: Each create/update now makes a KMS `GenerateDataKey` call (~5-15ms). Acceptable for the write volume of tax ID operations. Mitigated by the SDK's data key caching (`KMS_CACHE_TTL_SECONDS`, `KMS_CACHE_MAX_MESSAGES`).
- **Mendix v0 decrypt unverified**: The `decryptMendixV0()` implementation uses MD5-derived AES-128-CBC key. Exact Mendix key derivation must be verified against dev data before merging (tracked as P5-2).
- **Normalization sensitivity**: No hyphen stripping means callers must submit tax IDs in a consistent format. `123-45-6789` and `123456789` hash differently.

### Migration impact

- **Prior `createEncryptedTransformer` / `createWriteOnlyEncryptedTransformer`**: Removed. Replaced with explicit service-layer HMAC + last4 computation.
- **Existing data**: Any rows written with the old AES transformers contain ciphertext in the old columns. A one-time migration to populate `type_hashed` and `type_last4` from decrypted values is required (see ADR-PII-002).

---

## Follow-Up Work

### Phase 2: Wire BYTEA ciphertext column (KMS write path) — COMPLETE

Implemented in P4-1 through P4-4:

1. Registered `KMS_KEY_ARN`, `KMS_KEY_REGION`, `KMS_CACHE_TTL_SECONDS`, `KMS_CACHE_MAX_MESSAGES` in `@exprealty/config` `EncryptionEnvSchema`, merged into agent-service `ConfigSchema`. No separate Mendix key — `HMAC_SECRET` serves as the Mendix AES-128-CBC passphrase.
2. Created `SharedEncryptionModule` (`@Global()`) providing `FieldEncryptionService` via `createFieldEncryptionService()` (KMS) or `createLocalFieldEncryptionService()` (local). Replaced duplicate `taxIdHasherProvider` in both modules.
3. Pre-generated UUID via `randomUUID()` in service `create()` methods before calling `encryptField()` — solves `EncryptionContext.recordId` chicken-and-egg.
4. Wired `encryptField()` into `AgentCompanyService.prepareTaxFields()` and `AgentTaxService.computeTaxIdFields()`. All six columns populated on every write.

### Phase 3: Version-aware decrypt path (per-entity) — COMPLETE

Implemented in P4-5. Normal reads always return the masked `last4` value. Full-value decryption is explicit, via dedicated repository methods (`decryptTaxId`, `decryptTypeValue`):

- `encryption_version = null/undefined` — BYTEA is null, return null.
- `encryption_version = 0` — Mendix AES-128-CBC via `decryptMendixV0()` in `common/encryption/mendix-decrypt.ts`, using `HMAC_SECRET` as the passphrase.
- `encryption_version = 1` — KMS envelope via `FieldEncryptionService.decryptField(ciphertext, context)`.

### Phase 4: Consolidate `TaxIdHasher` factory + config integration — COMPLETE

Handled by Phase 2 `SharedEncryptionModule`. `TaxIdHasher` is a thin wrapper around `FieldEncryptionService.generateBlindIndex()`, provided once, injected everywhere.

### Phase 5: Lazy re-encryption — PENDING

When `decryptMendixV0()` succeeds on a version-0 row, optionally re-encrypt with KMS and update `encryption_version = 1`. Decision tracked in `tasks.md` P5-3. Over time this eliminates the version-0 decrypt path.

### Phase 6: Rotation wiring — COMPLETE

`TaxIdHasher` port now exposes `hashWithFallback()`. `HMAC_SECRET_PREVIOUS` is passed to `HmacService` via `SharedEncryptionModule`.

### Remaining work

- **P5-2**: Verify Mendix key derivation against dev data. The `decryptMendixV0()` implementation uses MD5-derived key — this may need adjustment based on the exact Mendix encryption module version.
- **P5-3**: Implement lazy re-encryption (decrypt v0 → re-encrypt as v1 on read).
- **Startup health log**: P4-6 adds `OnModuleInit` to `SharedEncryptionModule` to log active encryption mode and HMAC rotation status.

---

## References

- [NIST SP 800-107: HMAC Recommendations](https://csrc.nist.gov/publications/detail/sp/800-107/rev-1/final)
- [AWS KMS Envelope Encryption](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)
- [IRS Publication 1075: Tax Information Security](https://www.irs.gov/privacy-disclosure/safeguards-program)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- ADR-PII-002: Legacy Mendix Encrypted Data Migration Strategy
- ADR-PII-003: KMS Encryption Service-Layer Wiring Architecture
