# ADR-PII-001: Tax ID Storage Model and Encryption Adapter

## Status

**Proposed** - February 2026

## Context

The platform stores tax identifiers (SSN, EIN, GST/HST) for agents and agent companies. These are high-sensitivity PII subject to regulatory requirements (IRS Publication 1075, SOC 2, PCI-DSS adjacency). We need a storage model that:

1. **Minimises blast radius** - a database breach should not expose full tax IDs.
2. **Supports deterministic lookups** - "does this agent already have an SSN on file?" without decrypting.
3. **Displays partial values** - UI shows `***-**-6789` for identification, never full value.
4. **Supports key rotation** without downtime or data re-encryption in MVP.
5. **Provides a stable adapter interface** that hides cryptographic implementation details and can evolve post-MVP (e.g., KMS envelope encryption) without changing consumers.

### Current state

The `@exprealty/encryption` package currently implements AES-256-GCM with a random IV and scrypt-derived key. This means:

- Every encryption of the same plaintext produces a **different ciphertext** (non-deterministic).
- The `value_hashed` column uses `createWriteOnlyEncryptedTransformer()` which encrypts with a random IV. Despite its name, it does **not** hash; it cannot be used for equality lookups.
- The `value` column uses `createEncryptedTransformer({ maskOnRead: true })` which decrypts at read time and then applies presentation masking. The **full ciphertext** of the tax ID is stored in the database.
- The `tax_id` and `tax_id_hashed` columns on `agent_company` follow the same pattern.

### Affected entities

| Entity | Column | Current behaviour | Problem |
|--------|--------|-------------------|---------|
| `core.tax` | `value` | AES-256-GCM ciphertext (full tax ID) | Full PII in DB; breach = full exposure |
| `core.tax` | `value_hashed` | AES-256-GCM ciphertext (random IV) | Cannot be used for lookups; mislabelled |
| `core.agent_company` | `tax_id` | AES-256-GCM ciphertext (full tax ID) | Same as above |
| `core.agent_company` | `tax_id_hashed` | AES-256-GCM ciphertext (random IV) | Same as above |

## Decision

### 1. MVP storage model: last4 + deterministic token (no full ciphertext)

For MVP, we **do not store the full tax ID ciphertext** in the new database. Instead, each tax-related column pair stores:

| Column (DB name) | Semantic name | Content | Type |
|-------------------|---------------|---------|------|
| `value` / `tax_id` | `last4` | Last 4 characters of the tax ID, stored in cleartext | `text` |
| `value_hashed` / `tax_id_hashed` | `token` | Deterministic HMAC-SHA256 of the normalised full tax ID | `text` |

**Clarify naming semantics in code** even though DB column names keep their current names for migration simplicity:

```typescript
// Entity property names should communicate intent
@Column({ name: 'value', type: 'text' })
last4!: string  // Stores "6789", NOT a masked placeholder like "*****6789"

@Column({ name: 'value_hashed', type: 'text' })
token!: string  // Deterministic HMAC, usable for equality lookups
```

**Rules:**
- **Never persist masked placeholders** like `*****6789`. Masking is presentation-only, applied at the API response layer.
- The `last4` column stores exactly the last 4 characters (e.g., `6789`), no mask characters.
- The `token` column stores a deterministic HMAC so that `WHERE token = hmac(input)` works for duplicate detection and lookup.
- The caller submits the full tax ID on create/update; the service extracts `last4` and computes `token` before persisting. The full value is **not stored anywhere** in MVP.

### 2. Deterministic token: HMAC-SHA256

```
token = HMAC-SHA256(key=TOKEN_KEY, message=normalize(taxId))
```

- **Normalisation**: strip hyphens, spaces, lowercase. `123-45-6789` -> `123456789`.
- **Key**: a dedicated `TOKEN_KEY` (separate from any encryption key). Stored in AWS Secrets Manager, injected via environment variable.
- **Deterministic**: same input + same key = same output. Enables `WHERE token = $1` queries.
- **Not reversible**: HMAC output cannot recover the original tax ID.

### 3. Versioned crypto adapter: `@exprealty/encryption`

The `@exprealty/encryption` package exposes a **stable interface** that hides implementation details. Consumers import functions; they do not know whether the underlying mechanism is HMAC, AES, or KMS.

#### MVP public API

```typescript
// --- Token operations (deterministic, for lookups) ---

/** Compute a deterministic token for a plaintext value. */
export function computeToken(plaintext: string): string

/** Verify a plaintext matches a stored token. */
export function verifyToken(plaintext: string, token: string): boolean

// --- Display operations (presentation layer) ---

/** Extract last N characters for display. */
export function extractLast(value: string, n?: number): string

/** Mask a value for display: "123-45-6789" -> "***-**-6789". */
export function mask(value: string, visibleChars?: number): string

// --- Key management ---

/** Get the token key from environment / secrets manager. */
export function getTokenKey(): string

/** Check if token key is available. */
export function isTokenKeyConfigured(): boolean
```

#### Post-MVP additions (envelope encryption)

```typescript
// Added when full-value recovery is needed:
export function encrypt(plaintext: string): string      // KMS envelope encryption
export function decrypt(ciphertext: string): string     // KMS envelope decryption

// Existing MVP functions remain unchanged
```

Consumers that only need last4 + token (MVP) are unaffected when encrypt/decrypt are added.

### 4. Token rotation: keyring support

For key rotation without downtime, the token system supports a **keyring** of keys:

```
TOKEN_KEY=current-key-v2
TOKEN_KEY_PREVIOUS=previous-key-v1
```

**Lookup algorithm:**

```
1. Compute token with TOKEN_KEY (current)
2. Query: WHERE token = $currentToken
3. If no match AND TOKEN_KEY_PREVIOUS is set:
   a. Compute token with TOKEN_KEY_PREVIOUS
   b. Query: WHERE token = $previousToken
   c. If found: re-token the row with current key (lazy migration)
```

**Rotation procedure:**

1. Generate new key, set as `TOKEN_KEY`. Move old key to `TOKEN_KEY_PREVIOUS`.
2. Deploy. Lookups use both keys. Writes use current key.
3. Run background job to re-token all rows with current key.
4. After completion, remove `TOKEN_KEY_PREVIOUS`.

### 5. Security requirements

| Requirement | Implementation |
|-------------|----------------|
| Key storage | AWS Secrets Manager (prod/staging); `.env` file (local only) |
| Key injection | Environment variable, loaded at startup by `@exprealty/config` |
| Key separation | `TOKEN_KEY` (HMAC) is separate from any future `ENCRYPTION_KEY` (AES/KMS) |
| Least privilege | Only the agent-service IAM role can read the secret |
| Logging | Keys and full tax IDs are **never logged**. Log `last4` or `token` only |
| Dev fallback | Hardcoded dev key only when `NODE_ENV=local` or unset; throws in prod |
| Transport | All API traffic over TLS. Tax ID plaintext exists only in memory during request |

### 6. Entity column mapping (both entities)

#### `core.tax` (Tax entity)

```
+----------------+------+----------------------------------+
| DB Column      | Type | MVP Content                      |
+----------------+------+----------------------------------+
| id             | uuid | PK                               |
| tax_id_type    | text | 'SSN' | 'EIN' | 'GSN_HST'       |
| value          | text | last 4 chars (e.g. "6789")       |
| value_hashed   | text | HMAC-SHA256 token                |
| created        | tstz | audit                            |
| last_modified  | tstz | audit                            |
| modified_by    | text | audit                            |
+----------------+------+----------------------------------+
```

#### `core.agent_company` (AgentCompany entity)

```
+----------------+------+----------------------------------+
| DB Column      | Type | MVP Content                      |
+----------------+------+----------------------------------+
| tax_id         | text | last 4 chars (e.g. "6789")       |
| tax_id_hashed  | text | HMAC-SHA256 token                |
| use_ssn        | bool | whether to use SSN vs EIN        |
+----------------+------+----------------------------------+
```

## Alternatives Considered

### A. Store full AES-256-GCM ciphertext (current implementation)

- **Pro**: Full value recoverable from the database alone.
- **Con**: Database breach exposes all tax IDs (decrypt with stolen key). Violates data minimisation. Random IV makes lookups impossible. The `value_hashed` column is mislabelled and non-functional.
- **Rejected for MVP**: Unnecessary risk. The originating system of record retains full values.

### B. Deterministic AES (AES-SIV / AES-256-CBC with fixed IV)

- **Pro**: Encrypted and searchable.
- **Con**: Deterministic encryption leaks equality patterns and is vulnerable to frequency analysis on a small domain (SSNs have ~1B values). Adds complexity without meaningful security improvement over HMAC for the lookup use case.
- **Rejected**: HMAC is simpler, non-reversible, and sufficient for duplicate detection.

### C. AWS KMS envelope encryption with client-side caching

- **Pro**: Key never leaves KMS HSM. Supports automatic rotation. Audit trail via CloudTrail.
- **Con**: Adds latency (~5-15ms per call), requires AWS SDK dependency, higher cost, more complex error handling. Overkill for MVP where we don't need to recover the full value.
- **Deferred to post-MVP**: Good fit for the optional encrypted recovery column.

### D. Application-level hashing (bcrypt/argon2)

- **Pro**: Proven password-hashing algorithms.
- **Con**: Intentionally slow (bcrypt cost factor). Not suitable for high-throughput token computation on every write/lookup. HMAC is fast and deterministic by design.
- **Rejected**: Wrong tool for the job.

## Consequences

### Positive

- **Minimised blast radius**: Database contains only last4 + irreversible token. A breach does not expose full tax IDs.
- **Functional lookups**: Deterministic HMAC enables `WHERE token = $1` for duplicate detection without decryption.
- **Clean separation**: Masking is presentation-only. No masked placeholders in the database.
- **Stable interface**: `@exprealty/encryption` consumers are insulated from implementation changes.
- **Key rotation path**: Keyring approach enables zero-downtime rotation.

### Negative

- **No full-value recovery from this database**: If the originating system is unavailable, the full tax ID cannot be reconstructed from our data alone. This is acceptable for MVP; post-MVP adds an optional encrypted recovery column.
- **Two keys to manage**: `TOKEN_KEY` (HMAC) now, plus `ENCRYPTION_KEY` (AES/KMS) post-MVP. Mitigated by AWS Secrets Manager.
- **Re-tokenisation on rotation**: Background job required to re-hash all rows when rotating keys. Acceptable at current data volume.

### Migration impact

- **Existing `createEncryptedTransformer` / `createWriteOnlyEncryptedTransformer`**: Must be replaced with the new token/last4 logic. These functions and their TypeORM transformer wrappers are removed or deprecated in the encryption package.
- **Existing data**: Any rows written with the current AES transformers contain ciphertext that must be migrated (decrypt with old key, extract last4, compute HMAC token, update row). A one-time migration script is required.

## Follow-Up Work (Post-MVP)

### Phase 2: Optional encrypted recovery column

Add a third column for full-value recovery when business requirements demand it:

```
value_encrypted  text  -- KMS envelope-encrypted full tax ID (optional)
```

- Uses AWS KMS envelope encryption (data key encrypted by KMS CMK).
- Column is nullable; only populated when the business explicitly requires recovery.
- `@exprealty/encryption` adds `encrypt()` / `decrypt()` to the public API.
- Existing `computeToken()` / `extractLast()` remain unchanged.

### Phase 3: KMS envelope encryption details

- **Algorithm**: AES-256-GCM with KMS-generated data key.
- **Format**: `version:encryptedDataKey:iv:ciphertext:authTag` (all base64).
- **Key rotation**: KMS handles CMK rotation automatically. Data keys are per-row.
- **Caching**: AWS Encryption SDK client-side cache to reduce KMS API calls.
- **Audit**: All KMS operations logged to CloudTrail.

### Phase 4: Broader PII scope

Apply the same pattern to other PII fields as needed (bank account numbers, government IDs in other countries). The `@exprealty/encryption` adapter interface is designed to be reusable.

## References

- [NIST SP 800-107: HMAC Recommendations](https://csrc.nist.gov/publications/detail/sp/800-107/rev-1/final)
- [AWS KMS Envelope Encryption](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)
- [IRS Publication 1075: Tax Information Security](https://www.irs.gov/privacy-disclosure/safeguards-program)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
