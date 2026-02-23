# ADR-PII-003: KMS Encryption Service-Layer Wiring Architecture

## Status

**Accepted / Implemented** — February 2026

---

## Context

ADR-PII-001 established the six-column encrypted storage model (BYTEA ciphertext + HMAC blind index + last4 + key metadata) and deferred KMS wiring to a later phase. The `@exprealty/encryption` package was built and tested (P4-0), providing `FieldEncryptionService` as a framework-agnostic orchestrator for envelope encryption, HMAC blind indexing, and last-4 extraction.

This ADR documents the architectural decisions made when wiring `FieldEncryptionService` into the agent-service NestJS application — specifically how encryption is provided, how it interacts with the existing hexagonal architecture, and why certain patterns were chosen.

### Key constraint

**No database migrations.** All six encryption columns (`tax_id`/`type_value`, `*_hashed`, `*_last4`, `encryption_key_id`, `encryption_version`, `encrypted_at`) already existed in the schema with nullable types. They were always `null` for service-written rows. This change populates them — it is purely a service-layer change.

---

## Decisions

### 1. Global SharedEncryptionModule with factory providers

**File:** `services/agent-service/src/common/encryption/shared-encryption.module.ts`

```typescript
@Global()
@Module({
  providers: [
    { provide: 'FIELD_ENCRYPTION', useFactory: ..., inject: [ConfigService] },
    { provide: 'TaxIdHasher',      useFactory: ..., inject: ['FIELD_ENCRYPTION'] },
  ],
  exports: ['FIELD_ENCRYPTION', 'TaxIdHasher'],
})
export class SharedEncryptionModule {}
```

**Why `@Global()`:**
- Encryption is cross-cutting infrastructure, not a feature concern. Every module that handles PII needs it.
- Without `@Global()`, every feature module would need to `imports: [SharedEncryptionModule]`, which is boilerplate with no benefit — there's no scenario where a module intentionally opts out of encryption.
- The `@Global()` decorator is the NestJS equivalent of registering a singleton in a DI container at the root level.

**Why factory providers (not class providers):**
- `FieldEncryptionService` is constructed by `createFieldEncryptionService()` / `createLocalFieldEncryptionService()` factories from `@exprealty/encryption`. These factories validate config with Zod and wire internal services. A NestJS `@Injectable()` class provider would bypass this.
- The factory pattern keeps `@exprealty/encryption` framework-agnostic — no NestJS decorators in the package.

**Why two tokens (`FIELD_ENCRYPTION` + `TaxIdHasher`):**
- `FIELD_ENCRYPTION` provides the full `FieldEncryptionService` API: `encryptField()`, `decryptField()`, `generateBlindIndex()`, `generateBlindIndexWithFallback()`, `isHmacRotationActive()`.
- `TaxIdHasher` is a thin adapter preserving backward compatibility for any code that still uses `@Inject('TaxIdHasher')`. It delegates to `FieldEncryptionService.generateBlindIndex()` and `generateBlindIndexWithFallback()`.
- This allowed incremental migration: services were updated to use `FIELD_ENCRYPTION` directly, but the `TaxIdHasher` token remained available throughout.

### 2. Environment-based envelope service selection

```typescript
useFactory: (config: ConfigService): FieldEncryptionService => {
  if (config.get('NODE_ENV') === 'local') {
    return createLocalFieldEncryptionService(config.get('HMAC_SECRET'));
  }
  return createFieldEncryptionService({ kms: { ... }, hmac: { ... } });
}
```

**Decision:** `NODE_ENV === 'local'` uses `LocalEnvelopeService` (in-process AES-256-GCM derived from HMAC_SECRET). All other environments (`dev`, `test`, `prod`) use real KMS via `EnvelopeService`.

**Why:**
- Local development should not require KMS credentials or AWS connectivity.
- `LocalEnvelopeService` uses the same `IEnvelopeService` interface, so the `FieldEncryptionService` orchestrator is identical — only the envelope backend differs.
- The `createLocalFieldEncryptionService()` factory enforces that it cannot be used in non-local environments (throws if `NODE_ENV` is not `local`/`development`/`test`).

**Trade-off:** Local ciphertext is not decryptable by KMS (different key material). This is intentional — local development data is throwaway. If you need to test real KMS, set `NODE_ENV=dev` with valid AWS credentials.

### 3. Config registration: `EncryptionEnvSchema` opt-in merge

**File:** `packages/config/src/index.ts`

```typescript
export const EncryptionEnvSchema = z.object({
  KMS_KEY_ARN:            z.string().min(1),
  KMS_KEY_REGION:         z.string().default('us-east-1'),
  KMS_CACHE_TTL_SECONDS:  z.coerce.number().positive().optional(),
  KMS_CACHE_MAX_MESSAGES: z.coerce.number().positive().default(100),
});
```

Note: there is no separate `MENDIX_ENCRYPTION_KEY`. The `HMAC_SECRET` serves as both the HMAC blind index key and the Mendix AES-128-CBC passphrase (key derived via MD5). Single-key architecture.

**Decision:** `EncryptionEnvSchema` is exported separately from `BaseConfig`. Services opt in by merging:

```typescript
export const ConfigSchema = BaseConfig.extend({ ... }).merge(EncryptionEnvSchema).extend({ ... });
```

**Why not merge into `BaseConfig`:**
- Not all services handle PII. Non-PII services (e.g., a notification service) should not be forced to provide `KMS_KEY_ARN`.
- Fail-fast: Zod validates at startup. If `KMS_KEY_ARN` were in `BaseConfig` but not set, every service would fail to start.

**Why `KMS_KEY_ARN` is required (`z.string().min(1)`):**
- In non-local environments, KMS is mandatory. The `SharedEncryptionModule` factory only calls `createLocalFieldEncryptionService()` for `NODE_ENV=local`. All other paths require a valid ARN.
- For `NODE_ENV=local`, the Zod schema still requires `KMS_KEY_ARN` to be present in the environment, but its value is not used. This is a known trade-off — it simplifies the schema vs. conditional validation. Services use `.env.local` files to provide a placeholder value.

### 4. UUID pre-generation for encryption context binding

**Pattern in `AgentCompanyService.create()`:**

```typescript
const companyId = randomUUID();
const taxFields = await this.prepareTaxFields(dto.taxId, companyId);
const payload = { id: companyId, ...restDto, ...taxFields };
const company = await this.repository.create(payload);
```

**Problem solved:** `FieldEncryptionService.encryptField()` requires an `EncryptionContext` that includes `recordId` — the UUID primary key of the row being written. But on `create()`, the UUID doesn't exist yet (TypeORM would generate it on `INSERT`).

**Decision:** Pre-generate the UUID with `randomUUID()` before encryption, pass it as both the `recordId` in the encryption context and the `id` in the persistence payload.

**Why this is safe:**
- UUIDv4 from `randomUUID()` (Node.js `crypto` module, backed by OpenSSL CSPRNG) has negligible collision probability (~2^-122).
- TypeORM respects a pre-set `id` field — it uses `INSERT` with the provided value instead of relying on a database default.
- The encryption context AAD (Authenticated Associated Data) is now cryptographically bound to the specific row before it exists in the database. If the row's `id` were changed after encryption, decryption would fail (tamper detection).

**Pattern in `AgentTaxService.create()`:** Same approach — `const taxRecordId = randomUUID()` — for the `Tax` entity's `id`.

**Pattern in `update()`:** The row already exists, so the existing `id` is passed directly as `recordId`.

### 5. Async `prepareTaxFields` / `computeTaxIdFields`

**Before (synchronous):**

```typescript
private computeTaxIdFields(rawValue: string): { taxIdLast4: string; taxIdToken: string } {
  return {
    taxIdLast4: extractLastFour(rawValue),
    taxIdToken: this.hasher.hash(rawValue),
  };
}
```

**After (async):**

```typescript
private async prepareTaxFields(taxId: string | null | undefined, recordId: string) {
  // ... null/undefined/masked checks ...
  const result = await this.encryption.encryptField(taxId, {
    tableName: 'agent_company', recordId, fieldName: 'tax_id',
  });
  return {
    taxId: result.ciphertext,
    taxIdLast4: result.lastFour,
    taxIdToken: result.blindIndex,
    encryptionKeyId: result.keyId,
    encryptionVersion: result.encryptionVersion,
    encryptedAt: result.encryptedAt,
  };
}
```

**Why async:** `encryptField()` calls `EnvelopeService.encryptValue()`, which calls KMS `GenerateDataKey` — an async AWS SDK call. The method must propagate the `Promise`.

**Impact on callers:** `create()` and `update()` were already async (they call the repository). Adding `await` to `prepareTaxFields()` adds no new async boundary.

### 6. Return type expansion: six columns instead of two

**Before:** Services returned `{ taxIdLast4, taxIdToken }` to the repository.

**After:** Services return `{ taxId (Buffer), taxIdLast4, taxIdToken, encryptionKeyId, encryptionVersion, encryptedAt }`.

**Repository `mapToEntity` expanded** to map the new fields to entity columns:

| Service field | Entity column (AgentCompany) | Entity column (Tax) |
|--------------|------------------------------|---------------------|
| `taxId` (Buffer) | `taxId` (BYTEA) | `typeValue` (BYTEA) |
| `taxIdLast4` | `taxIdLast4` | `typeLast4` |
| `taxIdToken` | `taxIdHashed` | `typeHashed` |
| `encryptionKeyId` | `encryptionKeyId` | `encryptionKeyId` |
| `encryptionVersion` | `encryptionVersion` | `encryptionVersion` |
| `encryptedAt` | `encryptedAt` | `encryptedAt` |

**Why the extra fields pass through the service layer** (not computed in the repository):
- The service layer owns the encryption decision. The repository is a persistence adapter — it maps fields to columns but does not call encryption APIs.
- This follows hexagonal architecture: the repository port knows about persistence shapes, not about KMS.

### 7. Version-aware decryption dispatch

**File:** `common/encryption/mendix-decrypt.ts` + repository implementations

Decryption is an explicit async method on each repository port, not automatic on read:

```typescript
async decryptTaxId(id: string): Promise<string | null> {
  const entity = await this.repo.findOne({ where: { id } });
  if (!entity?.taxId) return null;

  switch (entity.encryptionVersion) {
    case null:
    case undefined:
      return null;                        // not yet encrypted
    case 0:
      return decryptMendixV0(entity.taxId, this.hmacSecret);
    case 1:
      return this.encryption.decryptField(entity.taxId, {
        tableName: 'agent_company', recordId: id, fieldName: 'tax_id',
      });
    default:
      this.logger.warn(`Unknown encryption version ${entity.encryptionVersion} for ${id}`);
      return null;
  }
}
```

**Why per-repository (not in `FieldEncryptionService`):**
- Version 0 (Mendix) uses AES-128-CBC with a different key derivation than version 1 (KMS). The Mendix format is entity-specific and may have data quirks from the migration.
- `FieldEncryptionService` only knows about version 1. Keeping version dispatch in the repository allows entity-specific error handling.

**Why `mapToDomain()` stays synchronous:**
- Normal reads always return the masked `*****XXXX` value derived from `last4`. No decryption needed for display.
- Decryption is an expensive, explicit operation. It should only happen when the caller genuinely needs the full plaintext (e.g., a "reveal tax ID" endpoint, a migration script, or a re-encryption job).

### 8. Mendix v0 decrypt: defensive, never throws

```typescript
export function decryptMendixV0(ciphertext: Buffer, passphrase: string): string | null {
  try {
    // ... AES-128-CBC decrypt ...
  } catch {
    return null;  // never throws
  }
}
```

**Decision:** `decryptMendixV0()` returns `null` on any failure (bad key, corrupt data, wrong format, missing prefix). It never throws.

**Why:**
- Mendix migration data quality is uncertain (see ADR-PII-002). Some rows may have plaintext, some may be corrupt, some may use a different key.
- A failing decrypt should not crash the application or abort a batch operation. The caller gets `null` and can decide how to handle it (log, flag for re-collection, skip).
- The exact Mendix key derivation (MD5 of passphrase) must be verified against dev data (P5-2). Until then, the function is best-effort.

### 9. Startup health log (P4-6)

`SharedEncryptionModule` implements `OnModuleInit` to log the active encryption mode at service startup:

```
[Encryption] Local envelope encryption active (no KMS)      # NODE_ENV=local
[Encryption] KMS key: arn:aws:kms:us-east-1:...             # all other envs
[Encryption] HMAC rotation active — dual-hash lookups enabled  # if HMAC_SECRET_PREVIOUS set
```

**Why:** Operators and on-call engineers need to quickly verify which encryption backend is active without reading code. This appears in CloudWatch logs on every deployment.

---

## Files Changed

### New files

| File | Purpose |
|------|---------|
| `services/agent-service/src/common/encryption/shared-encryption.module.ts` | `@Global()` NestJS module providing `FIELD_ENCRYPTION` and `TaxIdHasher` tokens |
| `services/agent-service/src/common/encryption/mendix-decrypt.ts` | Mendix AES-128-CBC `{AES3}` format decrypt utility |

### Modified files

| File | Change |
|------|--------|
| `packages/config/src/index.ts` | Added `EncryptionEnvSchema` export |
| `services/agent-service/src/core/configuration.ts` | Merged `EncryptionEnvSchema` into `ConfigSchema` |
| `services/agent-service/src/core/config.service.ts` | Added 4 encryption keys to `buildConfig()` fallback |
| `services/agent-service/src/app.module.ts` | Imported `SharedEncryptionModule` after `ConfigModule` |
| `services/agent-service/src/modules/agent-companies/agent-company-association.module.ts` | Removed `taxIdHasherProvider` from providers |
| `services/agent-service/src/modules/agent-companies/agent-company.service.ts` | Replaced `TaxIdHasher` with `FIELD_ENCRYPTION`; `prepareTaxFields` is now async and accepts `recordId`; `create()` pre-generates UUID |
| `services/agent-service/src/modules/agent-companies/agent-company.repository.ts` | `mapToEntity()` expanded for encryption columns; `decryptTaxId()` added |
| `services/agent-service/src/modules/agent-companies/ports/agent-company.repository.port.ts` | Added `decryptTaxId(id)` method |
| `services/agent-service/src/modules/agent-taxes/agent-tax.module.ts` | Removed `taxIdHasherProvider` from providers |
| `services/agent-service/src/modules/agent-taxes/agent-tax.service.ts` | Replaced `TaxIdHasher` with `FIELD_ENCRYPTION`; `computeTaxIdFields` is now async and accepts `taxRecordId`; `create()` pre-generates UUID |
| `services/agent-service/src/modules/agent-taxes/agent-tax.repository.ts` | `createWithTax()` and `updateTaxValue()` expanded for encryption columns; `decryptTypeValue()` added |
| `services/agent-service/src/modules/agent-taxes/ports/agent-tax.repository.port.ts` | `createWithTax()` and `updateTaxValue()` signatures expanded |

### Deleted files

| File | Reason |
|------|--------|
| *(none — `tax-id-hasher.provider.ts` and `tax-id-hasher.port.ts` retained for backward compatibility)* | |

---

## Data Flow Diagrams

### Write Path (create with tax ID)

```
Client POST /v1/agent-companies { taxId: "123-45-6789" }
    │
    ▼
AgentCompanyService.create()
    │
    ├── companyId = randomUUID()              ← pre-generate for AAD binding
    │
    ├── prepareTaxFields("123-45-6789", companyId)
    │       │
    │       └── encryption.encryptField("123-45-6789", {
    │               tableName: "agent_company",
    │               recordId: companyId,
    │               fieldName: "tax_id"
    │           })
    │           │
    │           ├── EnvelopeService.encryptValue()  ← KMS GenerateDataKey + AES-256-GCM
    │           ├── HmacService.hash()              ← HMAC-SHA256 blind index
    │           └── extractLastFour()               ← "6789"
    │           │
    │           └── Returns: { ciphertext, blindIndex, lastFour, keyId, encryptionVersion: 1, encryptedAt }
    │
    ├── payload = { id: companyId, taxId: ciphertext, taxIdLast4: "6789",
    │               taxIdToken: blindIndex, encryptionKeyId, encryptionVersion, encryptedAt, ...dto }
    │
    └── repository.create(payload)
            │
            └── mapToEntity() → INSERT into core.agent_company
                    (all 6 encryption columns populated)
```

### Read Path (normal — masked display)

```
Client GET /v1/agent-companies/:id
    │
    ▼
repository.findById()
    │
    └── mapToDomain()  ← SYNCHRONOUS, no decryption
            │
            └── taxId: entity.taxIdLast4 ? '*****' + entity.taxIdLast4 : null
                (returns "*****6789" — never decrypts BYTEA)
```

### Decrypt Path (explicit — full plaintext recovery)

```
repository.decryptTaxId(id)
    │
    ├── entity = findOne({ where: { id } })
    │
    └── switch (entity.encryptionVersion)
            │
            ├── null/undefined → return null   (not yet encrypted)
            │
            ├── 0 → decryptMendixV0(entity.taxId, mendixKey)
            │           └── AES-128-CBC with MD5-derived key
            │
            └── 1 → encryption.decryptField(entity.taxId, {
                        tableName: "agent_company",
                        recordId: id,
                        fieldName: "tax_id"
                    })
                    └── KMS Decrypt → DEK → AES-256-GCM decrypt → verify AAD
```

---

## Alternatives Considered

### A. Encrypt in the repository layer

**Rejected.** The repository is a persistence adapter. If it called encryption APIs, it would couple infrastructure concerns (KMS, HMAC secrets) into what should be a pure data access layer. The hexagonal architecture boundary would be violated.

### B. Use a TypeORM column transformer for automatic encrypt/decrypt

**Rejected.** This is exactly what the previous implementation did (`createEncryptedTransformer`). Problems:
- Transformers run on every read, even when only the masked value is needed. Unnecessary KMS calls and latency.
- Transformers are synchronous in TypeORM's API. `@aws-crypto/client-node` is async. A transformer would need to block the event loop or use a different mechanism.
- Transformers hide the encryption logic — harder to reason about, debug, and test.

### C. Conditional `KMS_KEY_ARN` validation (optional for local)

**Considered.** Could make `KMS_KEY_ARN` optional in the Zod schema and only validate when `NODE_ENV !== 'local'`. Rejected because:
- Zod conditional schemas (`z.discriminatedUnion`) add complexity.
- Having the key always present (even as a placeholder) is simpler and matches how `.env.local` files work in practice.
- If someone deploys with `NODE_ENV=dev` but forgets `KMS_KEY_ARN`, the startup error is immediate and clear.

### D. Single `FIELD_ENCRYPTION` token (drop `TaxIdHasher`)

**Deferred.** The `TaxIdHasher` port was retained as a thin adapter to avoid breaking any remaining consumers in a single PR. It can be removed in a future cleanup once all services use `FIELD_ENCRYPTION` directly.

---

## References

- ADR-PII-001: Tax ID Storage Model and Encryption Adapter
- ADR-PII-002: Legacy Mendix Encrypted Data Migration Strategy
- `@exprealty/encryption` README: Package architecture, API reference, data flow diagrams
- [AWS KMS Envelope Encryption](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)
- [NestJS Global Modules](https://docs.nestjs.com/modules#global-modules)
