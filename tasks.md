# Tax ID Implementation — Remediation Tasks

> Working task list generated from the code review of the `agent-company` and `tax` entity stacks.
> Delete this file on the final commit of the last phase.

---

## Phase 1 — Correctness & Type Safety
*Fixes for bugs, broken type contracts, and wrong validators. No new modules or dependencies.*

### P1-1 🔴 Replace conflict-check fan-out with a targeted query
**File:** `services/agent-service/src/modules/agent-taxes/agent-tax.service.ts:69`

**Problem:** `create()` loads all of an agent's taxes via `findByAgentId()` (capped at 50) and then scans in memory for a type collision. Structurally safe today (max 3 tax types), but the cap makes the guard look unreliable.

**Fix:** Add `findByAgentIdAndType(agentId, taxIdType)` to `IAgentTaxRepository` port and its TypeORM implementation. Replace the fan-out + `.some()` in `AgentTaxService.create()` with a single targeted query.

**Scope:** `agent-tax.repository.port.ts`, `agent-tax.repository.ts`, `agent-tax.service.ts`

---

### P1-2 🔴 `updateTaxValue` throws plain `Error` instead of `NotFoundException`
**File:** `services/agent-service/src/modules/agent-taxes/agent-tax.repository.ts:193`

**Problem:** If the tax record disappears between the `update()` and the re-fetch, the method throws `new Error(...)` which propagates as HTTP 500 instead of the expected 404.

**Fix:** Replace `throw new Error(...)` with `throw new NotFoundException({ message: ..., i18nType: 'agent.tax.not_found' })`.

**Scope:** `agent-tax.repository.ts` only

---

### P1-3 🟡 `NameBranded` is the wrong validator for `taxId`
**File:** `packages/shared-domain/src/schemas/agent-company.ts:83`

**Problem:** `taxId: z.string().trim().pipe(NameBranded).optional().nullable()` passes a tax ID value through the name brand validator. Semantically wrong; will confuse future readers and could silently reject valid tax ID formats if `NameBranded` ever adds name-specific constraints.

**Fix:** Replace with `z.string().trim().min(1).max(50).optional().nullable()` (or a named `TaxIdPlaintext` schema if reuse is anticipated).

**Scope:** `agent-company.ts` in `shared-domain`

---

### P1-4 🟡 Eliminate `null as any` in `prepareTaxFields`
**File:** `services/agent-service/src/modules/agent-companies/agent-company.service.ts:55`

**Problem:** `{ taxIdLast4: null as any, taxIdToken: null as any }` suppresses a real type mismatch between the domain `null` (explicit clear) and the entity column's `undefined | string`.

**Fix:** Change the return type of `prepareTaxFields` to `Record<string, string | null | undefined>` and replace `null as any` with typed `null`. Then ensure `mapToEntity` in the repository converts `null` → `undefined` explicitly rather than relying on `as any`.

**Scope:** `agent-company.service.ts`, `agent-company.repository.ts`

---

### P1-5 🟡 Eliminate `as any` on `repository.create()` / `update()` calls
**File:** `services/agent-service/src/modules/agent-companies/agent-company.service.ts:89, 196`

**Problem:** `{ ...restDto, ...taxFields } as any` is passed to `repository.create()` and `repository.update()`. The `as any` exists because `taxIdLast4`/`taxIdToken` are persistence-only fields not present on the `AgentCompany` domain type.

**Fix:** Introduce a `CreateAgentCompanyPersistenceInput` internal type (local to the service file, not exported) that extends `CreateAgentCompanyInput` with the two computed fields. Use this type at the service→repository boundary to replace both `as any` casts.

**Scope:** `agent-company.service.ts` only (type defined inline)

---

### P1-6 🔵 Remove always-true `existing.tax` null guard
**File:** `services/agent-service/src/modules/agent-taxes/agent-tax.service.ts:207`

**Problem:** `findById()` always loads the `tax` relation, so `existing.tax` can never be `undefined` after a successful find. The guard is misleading — it implies the tax might be absent.

**Fix:** Remove the `&& existing.tax` condition. Add an inline comment explaining that `tax` is always loaded by `findById`.

**Scope:** `agent-tax.service.ts` only

---

## Phase 2 — Schema & Documentation Alignment
*Entity comment corrections and schema documentation. Zero runtime changes.*

### P2-1 🟡 Correct entity class comment — BYTEA column is not yet active
**Files:** `packages/database/src/entities/core/agent-company.entity.ts:18`, `tax.entity.ts:21`

**Problem:** Both entities say `"Stores encrypted tax ID + blind index + last4"`. The BYTEA ciphertext column is always null — encryption is not wired. Misleads readers into thinking live encryption is running.

**Fix:** Update the JSDoc on both entity classes to:
`"Stores HMAC blind index + last4 for display. BYTEA ciphertext column (taxId / typeValue) is reserved for Phase 2 KMS encryption and is currently always null."`

**Scope:** Entity class JSDoc only — no column changes.

---

### P2-2 🔵 Add `encryption_version = 0` (Mendix) to entity column comment
**Files:** `agent-company.entity.ts:122`, `tax.entity.ts:94`

**Problem:** `encryptionVersion` column comment lists only version 1. Version 0 (Mendix AES-128-CBC, for migrated rows per ADR-PII-002) is undocumented.

**Fix:** Add to the column comment:
```
 *   0 = Mendix AES-128-CBC (legacy migrated rows — see ADR-PII-002)
 *   1 = @aws-crypto/client-node v4, AES-256-GCM, REQUIRE_ENCRYPT_REQUIRE_DECRYPT
```

**Scope:** Entity column comment only.

---

### P2-3 🔵 Document `taxIdToken` in public schema as an explicit design decision
**File:** `packages/shared-domain/src/schemas/agent-company.ts:38`

**Problem:** `taxIdToken` (the HMAC blind index) is returned in the API response. This is intentional (client-side deduplication), but the schema has no comment explaining the decision. Future developers may attempt to remove it.

**Fix:** Add a comment above the field:
```typescript
// Intentionally included in the API response: callers use this non-reversible
// HMAC token for client-side deduplication checks without exposing the full tax ID.
// Do not remove — see ADR-PII-001 §7.
taxIdToken: z.string().nullable().describe(...)
```

**Scope:** Schema comment only.

---

### P2-4 🔵 Document the 50-record cap in `findByAgentId`
**File:** `services/agent-service/src/modules/agent-taxes/agent-tax.repository.ts:113`

**Problem:** The magic number `50` has no explanation. The service's conflict-check logic (once P1-1 is done, this is less critical) relied on it being larger than the maximum tax types.

**Fix:** After P1-1 is done, add a comment:
```typescript
// Safety cap: agents have at most 3 tax types (SSN, EIN, GSN_HST).
// This cap is not relied on for duplicate detection (see findByAgentIdAndType).
const limit = Math.min(query?.limit ?? 25, 50);
```

**Scope:** Repository comment only. Do after P1-1.

---

### P2-5 🔵 `findByName` case-sensitivity — confirm or document
**File:** `services/agent-service/src/modules/agent-companies/agent-company.repository.ts:107`

**Problem:** `findOne({ where: { name } })` is an exact case-sensitive match. `"Acme Corp"` and `"ACME CORP"` would not be detected as duplicates.

**Fix:** Confirm with product whether this is intentional. If case-insensitive matching is desired, replace with a `ILIKE` query via QueryBuilder. If case-sensitive is correct, add a comment: `// Case-sensitive match — company names are stored and compared as-entered.`

**Scope:** `agent-company.repository.ts` — either a comment or a query change.

---

## Phase 3 — Architecture Consolidation
*Structural improvements requiring explicit approval. Each item is a standalone PR.*

### P3-1 🟡 Consolidate duplicate `TaxIdHasher` factory into a shared provider
**Files:** `agent-company-association.module.ts:63-72`, `agent-tax.module.ts:49-57`

**Problem:** The `TaxIdHasher` DI factory is byte-for-byte identical in both modules. Any future change (rotation support, config integration) must be made in two places.

**Options:**
- **A (minimal):** Export a `taxIdHasherProvider` constant from a new `providers/tax-id-hasher.provider.ts` file and import it in both modules. No new NestJS module needed.
- **B (full):** Create a `SharedEncryptionModule` that provides `TaxIdHasher` and can be imported by both modules.

Option A is lower blast radius. Option B is cleaner for future expansion. **Requires explicit approval.**

---

### P3-2 🟡 Load `HMAC_SECRET` via `@exprealty/config` instead of `process.env`
**Files:** `agent-company-association.module.ts:65`, `agent-tax.module.ts:50`

**Problem:** `process.env.HMAC_SECRET` is read directly, bypassing `@exprealty/config`'s startup validation. A missing secret surfaces at first request (DI factory call), not at boot time.

**Fix:** Register `HMAC_SECRET` in the config schema and inject it via the `ConfigService`. The factory becomes:
```typescript
useFactory: (config: ConfigService) => {
  const secret = config.get<string>('HMAC_SECRET');
  ...
},
inject: [ConfigService],
```

**Scope:** Config schema update + both module factories. **Requires explicit approval.**

---

### P3-3 🔵 Wire `HMAC_SECRET_PREVIOUS` for key rotation
**Files:** Both module factories, `tax-id-hasher.port.ts`

**Problem:** `HmacService` supports `{ current, previous? }` for zero-downtime HMAC rotation. The `TaxIdHasher` port exposes only `hash()` — the `hashWithFallback()` rotation path is unreachable.

**Fix:**
1. Extend `TaxIdHasher` port to add `hashWithFallback(): string[]`.
2. Pass `HMAC_SECRET_PREVIOUS` (if set) as `previous` in the factory keyring.
3. Update both `AgentCompanyService` and `AgentTaxService` to use `hashWithFallback()` for lookups during the rotation window.

**Scope:** Port interface + both factories + both services. **Requires explicit approval.** Tracked as ADR-PII-001 Phase 5.

---

## Phase 4 — KMS Encryption Wiring + `@exprealty/encryption` Enterprise Readiness
*All items require explicit approval. Each is a standalone PR.*
*`@exprealty/encryption` will be published to AWS CodeArtifact as a company-wide shared package. Quality bar is enterprise, not MVP.*

### What is already built (do not rebuild)

| Component | File | State |
|-----------|------|-------|
| `FieldEncryptionService` | `packages/encryption/src/services/field-encryption.service.ts` | Complete + tested |
| `EnvelopeService` | `packages/encryption/src/services/envelope.service.ts` | Complete — AWS Encryption SDK v4, KMS keyring, optional DEK cache |
| `HmacService` | `packages/encryption/src/services/hmac.service.ts` | Complete — rotation keyring built |
| `createFieldEncryptionService()` factory | `packages/encryption/src/factory.ts` | Complete — validates config with Zod, wires all three services |
| `EncryptionConfigSchema` | `packages/encryption/src/config/encryption.config.ts` | Complete — requires `kms.keyArn`, `kms.region`, `hmac.current`; optional `hmac.previous`, DEK cache settings |
| `mapEncryptedFieldToColumns()` | `packages/encryption/src/utils/field-mapper.ts` | Complete — maps `EncryptedFieldResult` to column names by prefix |
| `EncryptionContext` (AAD type) | `packages/encryption/src/types/encryption-context.types.ts` | Complete — `{ tableName, recordId, fieldName, tenantId? }` |
| Entity schema (BYTEA columns) | `agent-company.entity.ts`, `tax.entity.ts` | Complete — all 6 columns exist, nullable |
| Database migrations | `1770800000000-AddEncryptedPiiColumns.ts` | Complete — idempotent, `down()` implemented |

---

### Package-level gaps (must resolve before CodeArtifact publication)

---

### P4-0a Remove `"private": true` and publish guard

**File:** `packages/encryption/package.json`

**Problem:** `"private": true` and `"prepublishOnly": "echo 'Workspace-only during MVP' && exit 1"` both block publication to CodeArtifact. The package is currently workspace-only.

**Fix:** Remove `"private": true`. Replace `prepublishOnly` with a real pre-publish check (build passes, tests pass, CHANGELOG entry exists). Add `"publishConfig": { "registry": "<CodeArtifact URL>" }`. Confirm the package name `@exprealty/encryption` is the final name for the artifact registry.

**Scope:** `package.json` only.

---

### P4-0b Fix JSDoc naming inconsistency in `index.ts` and `factory.ts`

**File:** `packages/encryption/src/index.ts:21`, `factory.ts:22`

**Problem:** JSDoc examples say `@trupryce/encryption` but the actual package name is `@exprealty/encryption`. Any team consuming the package from CodeArtifact will use the wrong import. Also `factory.ts:28` says `hmac: { currentSecret: ... }` but `HmacConfig` uses `hmac: { current: ... }` — consumers copying the example code will get a Zod error at runtime.

**Fix:** Update all JSDoc examples to use `@exprealty/encryption` and `hmac: { current: ... }`.

**Scope:** `index.ts` comments, `factory.ts` JSDoc.

---

### P4-0c Remove `clientProvider: () => undefined as any` hack from `EnvelopeService`

**File:** `packages/encryption/src/services/envelope.service.ts:52-57`

**Problem:**
```typescript
clientProvider: (awsRegion: string) => {
  return undefined as any; // SDK falls back to default credential provider
}
```
This is a cast that hides a type error. The AWS Encryption SDK `clientProvider` callback is typed to return a `KMSClient` — returning `undefined` is incorrect. It happens to work because the SDK internally falls back to the default credential chain when the provider returns a falsy value, but this is undocumented SDK behavior, not a contract.

For an enterprise package, this must be explicit: either pass no `clientProvider` (let the SDK use its default) or construct a `KMSClient` explicitly and pass it. The `as any` must not appear in a published package.

**Fix:** Remove the `clientProvider` option entirely (the keyring will use the default credential chain) or construct the `KMSClient` explicitly with the region. Either way, remove the `as any`.

**Scope:** `envelope.service.ts` constructor only.

---

### P4-0d Add typed error classes for enterprise consumers

**Problem:** KMS failures, context mismatches, and decrypt errors all surface as generic `Error` instances. Consumers from other teams cannot `catch (e) { if (e instanceof EncryptionError) ... }` — they must parse error messages as strings.

**Fix:** Add `packages/encryption/src/errors/encryption-errors.ts`:
```typescript
export class EncryptionError extends Error { constructor(message: string, public readonly cause?: unknown) { ... } }
export class DecryptionError extends EncryptionError {}
export class ContextMismatchError extends DecryptionError {}  // replaces the bare Error throw in EnvelopeService
export class KeyNotFoundError extends EncryptionError {}
```
Replace all bare `throw new Error(...)` inside the package with these typed classes. Export them from `index.ts`.

**Scope:** New `src/errors/` directory, updates to `envelope.service.ts`, export in `index.ts`.

---

### P4-0e Add `createLocalFieldEncryptionService()` for local/test use

**Problem:** Teams consuming `@exprealty/encryption` from CodeArtifact need to use it in local development and CI without KMS access. Constructing any `FieldEncryptionService` today requires a valid KMS key ARN — it will fail in environments without AWS credentials.

**Fix:** Export a second factory backed by in-process AES-256-GCM (no KMS):

```typescript
/**
 * Creates a FieldEncryptionService backed by in-process AES-256-GCM.
 * For local development and unit testing ONLY. Never use in staging or prod.
 * Throws if NODE_ENV is not 'local' or 'test'.
 */
export function createLocalFieldEncryptionService(hmacSecret: string): FieldEncryptionService
```

`LocalEnvelopeService` implements the same interface as `EnvelopeService` using `crypto.createCipheriv('aes-256-gcm', ...)` with a key derived from the HMAC secret. API is identical — callers change nothing between local and prod.

**Scope:** New `src/services/local-envelope.service.ts` + updated `factory.ts` export + tests. Tests should use this instead of mocking the whole service.

---

### P4-0f Add CHANGELOG and semantic versioning policy

**Problem:** Publishing `0.1.0` to CodeArtifact with no CHANGELOG and no documented breaking change policy puts consuming teams at risk on upgrades.

**Fix:** Create `packages/encryption/CHANGELOG.md` documenting the initial `0.1.0` API surface. Adopt semver: breaking changes to `EncryptionConfig`, `EncryptedFieldResult`, `EncryptionContext` interfaces are major bumps. Document the policy in the README.

**Scope:** `CHANGELOG.md` + `README.md` update.

---

### Service-layer wiring gaps

---

### P4-1 Register encryption config vars in `@exprealty/config`

**Problem:** `HMAC_SECRET`, `KMS_KEY_ARN`, `KMS_KEY_REGION`, `HMAC_SECRET_PREVIOUS`, `KMS_CACHE_TTL_SECONDS`, `KMS_CACHE_MAX_MESSAGES` are not in the `BaseConfig` Zod schema. They are invisible to the config validation layer and won't fail-fast on startup if missing.

**Fix:** Add an `EncryptionEnvSchema` to `@exprealty/config` that the agent-service merges into its app config schema. This is a prerequisite for every other P4 item.

```typescript
export const EncryptionEnvSchema = z.object({
  HMAC_SECRET:            z.string().min(32),
  HMAC_SECRET_PREVIOUS:   z.string().min(32).optional(),
  KMS_KEY_ARN:            z.string().min(1),
  KMS_KEY_REGION:         z.string().default('us-east-1'),
  KMS_CACHE_TTL_SECONDS:  z.coerce.number().positive().optional(),
  KMS_CACHE_MAX_MESSAGES: z.coerce.number().positive().default(100),
});
```

**Scope:** `packages/config/src/index.ts`

---

### P4-2 Create `SharedEncryptionModule` providing `FieldEncryptionService`

**Problem:** `createFieldEncryptionService()` is never called anywhere in the service layer. No NestJS DI provider exists for it. Both `AgentCompanyService` and `AgentTaxService` need it, so a shared module is the right container.

**Fix:** Create `services/agent-service/src/common/encryption/encryption.module.ts`:

```typescript
@Global()
@Module({
  providers: [
    {
      provide: 'FIELD_ENCRYPTION',
      useFactory: (config: AppConfigService) =>
        createFieldEncryptionService({
          kms: {
            keyArn:          config.get('KMS_KEY_ARN'),
            region:          config.get('KMS_KEY_REGION'),
            cacheTtlSeconds: config.get('KMS_CACHE_TTL_SECONDS'),
            cacheMaxMessages:config.get('KMS_CACHE_MAX_MESSAGES'),
          },
          hmac: {
            current:  config.get('HMAC_SECRET'),
            previous: config.get('HMAC_SECRET_PREVIOUS'),
          },
        }),
      inject: [AppConfigService],
    },
  ],
  exports: ['FIELD_ENCRYPTION'],
})
export class SharedEncryptionModule {}
```

This also replaces the duplicate `TaxIdHasher` factory from P3-1: `TaxIdHasher` becomes a thin wrapper around the `FieldEncryptionService`'s blind index method, provided here once.

**Scope:** New file + import in `AppModule`. **Requires explicit approval.**

---

### P4-3 Solve `EncryptionContext.recordId` chicken-and-egg on `create`

**Problem:** `encryptField()` requires `{ tableName, recordId, fieldName }` as AAD. On a `create` operation the record doesn't have a UUID yet — TypeORM generates it at insert time. Passing the wrong or empty `recordId` means decryption will fail if the record is ever moved or the context doesn't match.

**Fix:** Generate the UUID in the service layer before calling `encryptField()`:

```typescript
import { randomUUID } from 'node:crypto';

// In AgentCompanyService.create():
const newId = randomUUID();
const encrypted = await this.encryption.encryptField(dto.taxId, {
  tableName: 'agent_company',
  recordId: newId,
  fieldName: 'tax_id',
});
// Pass newId as entity.id — TypeORM respects a pre-assigned UUID PK
await this.repository.create({ ...fields, id: newId, ...mapEncryptedFieldToColumns(encrypted, 'tax_id') });
```

This requires `IAgentCompanyRepository.create()` to accept an optional `id` field. Same pattern applies to `AgentTaxService` for the `Tax` record inside the transaction.

**Scope:** Both services + both repository port interfaces. **Requires explicit approval.**

---

### P4-4 Wire `encryptField()` into `AgentCompanyService` and `AgentTaxService`

**Problem:** Neither service calls `encryptField()`. The BYTEA column is always null.

**Fix (AgentCompanyService):**
- Inject `@Inject('FIELD_ENCRYPTION') private readonly encryption: FieldEncryptionService`
- In `computeTaxIdFields()` (or its replacement): call `await this.encryption.encryptField(rawValue, context)` using the UUID from P4-3
- Replace `prepareTaxFields()` return with `mapEncryptedFieldToColumns(result, 'tax_id')` plus the `id` field
- Drop the separate `taxIdLast4` / `taxIdToken` fields — `mapEncryptedFieldToColumns` produces them

**Fix (AgentTaxService):**
- Same injection
- In `createWithTax`: encrypt before the transaction begins, pass pre-computed columns into the transaction
- In `updateTaxValue`: encrypt with the existing `taxId` UUID as `recordId`

**Scope:** Both services. **Requires explicit approval.**

---

### P4-5 Add version-aware decrypt path to both repositories (per-entity)

**Versions in play:**

| `encryption_version` | BYTEA content | Decrypt path |
|----------------------|---------------|--------------|
| `null` | `null` | Not yet encrypted — return `null`; masked `last4` is the display value |
| `0` | Mendix AES-128-CBC `{AES3}<base64>` | **Per-entity** version-0 decrypt (service layer, not the shared package) |
| `1` | AWS KMS envelope (AES-256-GCM) | `FieldEncryptionService.decryptField(ciphertext, context)` |

**Architecture decision:** Mendix version-0 decrypt is **not** in `@exprealty/encryption`. It is implemented per-entity in the service layer. The shared package stays clean of legacy format concerns. Two entities (`agent_company`, `tax`) each get their own `decryptV0(blob: Buffer): string | null` implementation.

**Why per-entity:** Mendix migration data may be inconsistent in ways that are specific to each entity — different field populations, different failure patterns. A generic utility cannot encode those assumptions safely.

**The same key is used for both Mendix (version 0) and KMS (version 1).** There is no separate "Mendix key". The `MENDIX_ENCRYPTION_KEY` env var holds the same underlying key material that was used in Mendix and is now also the KMS-protected value.

**Version-0 BYTEA may contain (per entity, confirm in dev — see P5-2):**
- `{AES3}<base64(IV||ciphertext)>` — well-formed Mendix AES-128-CBC
- Plaintext (no prefix) — Mendix stored it unencrypted
- `null` — migration did not populate BYTEA for this row
- Corrupt / truncated blob — must not throw; return `null` and log

**Decision confirmed:** `mapToDomain` always returns the masked `last4` value. Decryption is explicit, via a dedicated repository method, not on every read.

**Fix pattern per repository:**
```typescript
// In AgentCompanyTypeOrmRepository:
async decryptTaxId(id: string): Promise<string | null> {
  const entity = await this.repo.findOne({ where: { id } });
  if (!entity?.taxId) return null;

  if (entity.encryptionVersion === 0) {
    return this.decryptV0(entity.taxId);          // entity-specific, see below
  }
  if (entity.encryptionVersion === 1) {
    return this.encryption.decryptField(entity.taxId, {
      tableName: 'agent_company',
      recordId: id,
      fieldName: 'tax_id',
    });
  }
  return null;
}

// Per-entity version-0 decrypt — lives only in this repository:
private decryptV0(blob: Buffer): string | null {
  // AES-128-CBC, {AES3} prefix, MENDIX_ENCRYPTION_KEY
  // Returns null on any failure — never throws
}
```

The same pattern applies to `AgentTaxTypeOrmRepository` for `type_value`.

**Config:** Register `MENDIX_ENCRYPTION_KEY` in `@exprealty/config` alongside the KMS vars (P4-1). It is the same key, surfaced under a distinct env var for clarity.

**Scope:** Both repositories + P4-1 config addition. **Requires explicit approval.**

---

### P4-6 `EnvelopeService` local credential story

**Problem:** `EnvelopeService.clientProvider` returns `undefined as any`, relying on the default AWS credential chain. For local development this requires `~/.aws/credentials` or env vars. There is no documented setup path and no clear error when KMS calls fail locally.

**Fix:** P4-0e (`createLocalFieldEncryptionService`) resolves this for application code. Separately, document the required AWS profile setup in a runbook for developers who need to run the full KMS path locally. Add a startup health log that confirms KMS connectivity (call `EnvelopeService.getKeyId()` and log the resolved ARN at boot).

**Scope:** Runbook addition + startup log in `SharedEncryptionModule`. **Requires explicit approval.**

---

## Phase 5 — Mendix Data Verification + Lazy Re-encryption
*Do after Phase 4 is complete.*
*The Mendix app writes version-0 rows. Our service reads and eventually re-encrypts them to version-1.*

### Context

- Mendix `Encryption.EncryptionKey` is confirmed. Dev data is populated.
- The Mendix app stores `{AES3}<base64(IV||ciphertext)>` in the BYTEA column with `encryption_version = 0`.
- The **same key** is used for both Mendix AES-128-CBC (version 0) and KMS (version 1). There is no separate "Mendix key" — `MENDIX_ENCRYPTION_KEY` is the same underlying key material.
- Per-entity `decryptV0()` implementations live in each repository (P4-5). This is the read path for version-0 rows.
- Our service does NOT run a bulk migration script. Re-encryption to version 1 happens lazily or via a future bulk job.

---

### P5-1 Verify HMAC continuity against dev data

**Purpose:** Confirm that HMAC tokens written by the Mendix app match tokens our service would compute for the same plaintext. If they diverge, all token-based lookups on migrated rows will silently miss.

**Steps:**
1. Pick 5–10 rows in dev where `encryption_version = 0` and `type_hashed IS NOT NULL`.
2. Run the per-entity `decryptV0()` to recover plaintext from the BYTEA column.
3. Call `HmacService.hash(plaintext)` with the service's `HMAC_SECRET`.
4. Assert the result matches the stored `type_hashed` / `tax_id_hashed`.

If they do not match, the Mendix app applied different normalization (e.g., stripping hyphens) or used a different key. This is a breaking incompatibility that must be resolved — duplicate detection and lookup-by-token will not work on migrated rows.

**Scope:** Throwaway verification script or Jest integration test against dev DB. Not shipped to production.

---

### P5-2 Confirm per-entity inconsistency patterns in dev data

Run these queries on dev and document results in ADR-PII-002. The output drives the defensive branching logic in each `decryptV0()` implementation (P4-5).

```sql
-- core.tax
SELECT
  COUNT(*) FILTER (WHERE type_value IS NULL)                                         AS null_bytea,
  COUNT(*) FILTER (WHERE type_value IS NOT NULL
    AND convert_from(type_value, 'UTF8') LIKE '{AES3}%')                             AS aes3_prefix,
  COUNT(*) FILTER (WHERE type_value IS NOT NULL
    AND convert_from(type_value, 'UTF8') NOT LIKE '{AES3}%')                         AS plaintext_or_unknown,
  COUNT(*) FILTER (WHERE type_last4 IS NULL)                                         AS null_last4,
  COUNT(*) FILTER (WHERE type_hashed IS NULL)                                        AS null_hashed
FROM core.tax WHERE encryption_version = 0;

-- core.agent_company
SELECT
  COUNT(*) FILTER (WHERE tax_id IS NULL)                                             AS null_bytea,
  COUNT(*) FILTER (WHERE tax_id IS NOT NULL
    AND convert_from(tax_id, 'UTF8') LIKE '{AES3}%')                                 AS aes3_prefix,
  COUNT(*) FILTER (WHERE tax_id IS NOT NULL
    AND convert_from(tax_id, 'UTF8') NOT LIKE '{AES3}%')                             AS plaintext_or_unknown,
  COUNT(*) FILTER (WHERE tax_id_last4 IS NULL)                                       AS null_last4,
  COUNT(*) FILTER (WHERE tax_id_hashed IS NULL)                                      AS null_hashed
FROM core.agent_company WHERE encryption_version = 0;
```

---

### P5-3 Decide lazy re-encryption strategy and document in ADR-PII-001

**Decision required:** When `decryptV0()` succeeds, do we immediately re-encrypt to version 1?

- **Option A — Lazy re-encryption (recommended):** After a successful version-0 decrypt for a user-triggered request, fire a background job (or inline update) to re-encrypt with KMS and set `encryption_version = 1`. Over time version-0 rows naturally become version-1. The `decryptV0()` path eventually becomes dead code and can be removed.
- **Option B — Bulk backfill job:** Version-0 rows stay version-0 until a scheduled job re-encrypts all of them. Simpler per-request path, but the Mendix decrypt logic must be maintained until the job completes.

Document the decision in ADR-PII-001 under Follow-Up Work. This determines whether `decryptTaxId()` in the repository (P4-5) triggers a re-encryption write after a successful version-0 read.

---

### P5-4 Re-collection workflow (separate Jira)

If `decryptV0()` returns `null` for a row (corrupt blob, failed Mendix migration), the user must re-enter their tax ID. Track the UI/API re-collection flow as a separate Jira. Not a blocker — the service already gracefully falls back to the masked `last4` display when decrypt fails.

---

## Completion Checklist

- [ ] P1-1: Targeted conflict-check query
- [ ] P1-2: `NotFoundException` in `updateTaxValue`
- [ ] P1-3: Fix `taxId` validator in `CreateAgentCompanyInput`
- [ ] P1-4: Remove `null as any` in `prepareTaxFields`
- [ ] P1-5: Remove `as any` on repository calls
- [ ] P1-6: Remove always-true `existing.tax` guard
- [ ] P2-1: Entity class comment correction
- [ ] P2-2: Add version 0 to `encryptionVersion` comment
- [ ] P2-3: Document `taxIdToken` design decision in schema
- [ ] P2-4: Document `50` cap (after P1-1)
- [ ] P2-5: Confirm / document `findByName` case sensitivity
- [ ] P3-1: Consolidate `TaxIdHasher` factory *(approval required)*
- [ ] P3-2: `HMAC_SECRET` via `@exprealty/config` *(approval required)*
- [ ] P3-3: Wire rotation fallback *(approval required)*
**Package enterprise readiness (P4-0 series) — separate Jira:**
- [ ] P4-0a: Remove `clientProvider: () => undefined as any` from `EnvelopeService`
- [ ] P4-0b: Add typed error classes (`EncryptionError`, `DecryptionError`, `ContextMismatchError`, `KeyNotFoundError`)
- [ ] P4-0c: Add `createLocalFieldEncryptionService()` for local/test use
- [ ] P4-0d: Add CHANGELOG and semver policy

**Service-layer wiring (P4-1 through P4-6):**
- [ ] P4-1: Register `HMAC_SECRET`, `KMS_KEY_ARN`, `MENDIX_ENCRYPTION_KEY` etc. in `@exprealty/config` *(approval required)*
- [ ] P4-2: `SharedEncryptionModule` providing `FieldEncryptionService` + replaces duplicate `TaxIdHasher` factory *(approval required)*
- [ ] P4-3: UUID pre-generation for `EncryptionContext.recordId` on `create` *(approval required)*
- [ ] P4-4: Wire `encryptField()` into both services *(approval required)*
- [ ] P4-5: Per-entity version-0 `decryptV0()` + version-1 `decryptField()` path in both repositories *(approval required)*
- [ ] P4-6: Local credential runbook + startup KMS health log *(approval required)*

**Mendix verification (Phase 5, do after Phase 4):**
- [ ] P5-1: HMAC continuity verification against dev data
- [ ] P5-2: Per-entity inconsistency queries against dev; document results in ADR-PII-002
- [ ] P5-3: Lazy re-encryption strategy decision; document in ADR-PII-001
- [ ] P5-4: Re-collection workflow *(separate Jira)*

> **Delete this file on the final commit of the last completed phase.**
