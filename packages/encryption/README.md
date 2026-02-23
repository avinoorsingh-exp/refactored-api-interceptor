# @exprealty/encryption

Field-level AES-256 encryption for persisted PII using AWS KMS envelope encryption, HMAC-SHA256 blind indexing with rotation support, and last-4 extraction for masked display.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Package Structure](#package-structure)
- [Dependencies](#dependencies)
- [Configuration](#configuration)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Database Column Patterns](#database-column-patterns)
- [Usage Examples](#usage-examples)
- [HMAC Key Rotation](#hmac-key-rotation)
- [KMS Key Rotation](#kms-key-rotation)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Design Decisions](#design-decisions)
- [Versioning Policy](#versioning-policy)

---

## Architecture Overview

This package is **framework-agnostic** — it has zero dependency on NestJS, TypeORM, or any application framework. It is pure TypeScript with two production dependencies: `@aws-crypto/client-node` (AWS Encryption SDK) and `zod` (config validation).

The package orchestrates three independent concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                  FieldEncryptionService                      │
│                  (orchestrator — main API)                   │
│                                                             │
│   encryptField(plaintext, context) → EncryptedFieldResult   │
│   decryptField(input, context) → string                     │
│   lookupHashes(plaintext) → string[]                        │
│                                                             │
├──────────────┬──────────────────┬───────────────────────────┤
│              │                  │                           │
│  EnvelopeService          HmacService            last4.ts  │
│  (AWS KMS)                (blind index)          (utility)  │
│                                                             │
│  - KMS keyring            - HMAC-SHA256          - strips   │
│  - envelope encrypt       - rotation-aware         formatting│
│  - AAD context            - current + previous   - last 4   │
│    verification             key support            chars    │
└──────────────┴──────────────────┴───────────────────────────┘
```

### Data Flow — Encrypt

```
plaintext ("123-45-6789")
    │
    ├──→ EnvelopeService.encryptValue()
    │       → KMS GenerateDataKey → DEK
    │       → AES-256-GCM encrypt with DEK
    │       → Returns SDK encrypted message (IV + encrypted DEK + ciphertext + auth tag)
    │       → Stored as `bytea` in Postgres
    │
    ├──→ HmacService.hash()
    │       → HMAC-SHA256 with current key
    │       → Returns 64-char hex string
    │       → Stored as `char(64)` in Postgres
    │
    └──→ extractLastFour()
            → Strip non-alphanumeric → "1234567890"
            → Last 4 → "6789"
            → Stored as `char(4)` in Postgres
```

### Data Flow — Decrypt

```
ciphertext (Buffer) + EncryptionContext
    │
    └──→ EnvelopeService.decryptValue()
            → Read encrypted DEK from message header
            → KMS Decrypt → plaintext DEK
            → AES-256-GCM decrypt
            → Verify encryption context (AAD) matches expected
            → Returns plaintext string
```

### Data Flow — Lookup

```
plaintext ("123-45-6789")
    │
    └──→ HmacService.hashForLookup()
            → HMAC with current key → hash1
            → HMAC with previous key (if rotating) → hash2
            → Returns [hash1] or [hash1, hash2]
            → Query: WHERE column_hashed = ANY($1)
```

---

## Package Structure

```
packages/encryption/
├── src/
│   ├── index.ts                              Public barrel — all exports
│   │
│   ├── config/
│   │   └── encryption.config.ts              Zod schema, EncryptionConfig type
│   │                                         Contains inline HmacConfigSchema
│   │                                         No separate hmac.config file
│   │
│   ├── services/
│   │   ├── envelope.service.ts               AWS Encryption SDK wrapper
│   │   │                                     KMS keyring, encrypt, decrypt
│   │   │                                     AAD context verification on decrypt
│   │   │
│   │   ├── hmac.service.ts                   HMAC-SHA256 blind indexing
│   │   │                                     Rotation-aware (current + previous)
│   │   │                                     No AWS dependency — uses Node crypto
│   │   │
│   │   └── field-encryption.service.ts       Orchestrator — main public API
│   │                                         Composes envelope + hmac + last4
│   │
│   ├── types/
│   │   ├── encrypted-field.types.ts          EncryptedFieldResult interface
│   │   └── encryption-context.types.ts       EncryptionContext interface
│   │                                         toSdkEncryptionContext() converter
│   │
│   ├── utils/
│   │   ├── last4.ts                          extractLastFour() — strips + slices
│   │   └── field-mapper.ts                   mapEncryptedFieldToColumns()
│   │                                         mapMultipleEncryptedFields()
│   │
│   └── factory.ts                            createFieldEncryptionService()
│                                             Validates config, wires services
│
├── test/
│   ├── encryption.config.spec.ts             Config validation tests
│   ├── hmac.service.spec.ts                  HMAC determinism + rotation tests
│   ├── field-encryption.service.spec.ts      Orchestrator tests (mocked KMS)
│   ├── last4.spec.ts                         Last-4 extraction edge cases
│   ├── field-mapper.spec.ts                  Column mapping tests
│   └── fixtures/
│       └── test-keys.ts                      Deterministic test secrets
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Dependencies

```json
{
  "dependencies": {
    "@aws-crypto/client-node": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

No framework dependencies. No TypeORM. No NestJS. Uses Node built-in `crypto` for HMAC.

---

## Configuration

### Schema

The config uses nested `kms` and `hmac` objects. Defined in `src/config/encryption.config.ts`:

```typescript
export const EncryptionConfigSchema = z.object({
  kms: z.object({
    keyArn: z.string().min(1, 'KMS key ARN is required'),
    region: z.string().default('us-east-1'),
    cacheTtlSeconds: z.number().positive().optional(),
    cacheMaxMessages: z.number().positive().default(100),
  }),

  hmac: HmacConfigSchema,  // inlined in same file, NOT a separate import
});
```

The `HmacConfigSchema` is defined inline in the same file:

```typescript
const HmacConfigSchema = z.object({
  current: z.string().min(32, '...'),
  previous: z.string().min(32, '...').optional(),
});
```

### Type Access

The exported type is `EncryptionConfig`. There is **no separate `HmacConfig` or `HmacSecrets` export**. Services that need the HMAC sub-type derive it from the parent:

```typescript
import type { EncryptionConfig } from '../config/encryption.config';

constructor(secrets: EncryptionConfig['hmac']) {
```

### Config Source

The package does NOT source its own config. The consuming application (via `@exprealty/config` or however) resolves secrets and passes a plain object to the factory:

```typescript
const encryption = createFieldEncryptionService({
  kms: {
    keyArn: await configService.get('KMS_KEY_ARN'),
    region: await configService.get('AWS_REGION'),
  },
  hmac: {
    current: await configService.get('HMAC_SECRET_CURRENT'),
    previous: await configService.get('HMAC_SECRET_PREVIOUS'), // optional
  },
});
```

Zod validates at construction time. Invalid config throws `ZodError` immediately.

---

## Core Concepts

### Envelope Encryption (EnvelopeService)

Uses `@aws-crypto/client-node` with `CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT` (strictest).

- **Encrypt**: KMS `GenerateDataKey` → plaintext DEK + encrypted DEK. AES-256-GCM encrypts the data with the DEK. The SDK bundles IV, encrypted DEK, ciphertext, and auth tag into a single `Buffer`.
- **Decrypt**: SDK reads the encrypted DEK from the message, calls KMS `Decrypt`, recovers the DEK, decrypts the data.
- **Key rotation**: Transparent. The encrypted DEK travels with the ciphertext. Rotate the CMK in KMS; old data still decrypts. No re-encryption needed.

### Encryption Context (AAD)

Every encrypt/decrypt operation includes an `EncryptionContext`:

```typescript
interface EncryptionContext {
  tenantId?: string;   // optional multi-tenant isolation
  tableName: string;   // e.g., 'agent_companies'
  recordId: string;    // e.g., UUID primary key
  fieldName: string;   // e.g., 'tax_id'
}
```

This is converted to `Record<string, string>` via `toSdkEncryptionContext()` and passed to the SDK as `encryptionContext`. It is:
- **Not encrypted** — stored in plaintext in the message header
- **Authenticated** — included in the GCM auth tag calculation
- **Verified on decrypt** — if context doesn't match, decryption throws

This prevents ciphertext from being copied between rows/tables/tenants.

### Blind Indexing (HmacService)

HMAC-SHA256 produces a deterministic, one-way hash of the plaintext. This enables exact-match lookups (`WHERE tax_id_hashed = $1`) without decrypting every row.

- Uses a **separate secret** from the KMS encryption key
- The HMAC key is sourced from the config (via Secrets Manager, env, etc.)
- **Rotation-aware**: supports `current` + `previous` keys simultaneously

### Last-4 Extraction

`extractLastFour()` strips all non-alphanumeric characters then takes the last 4. This is computed at write time from the plaintext and stored as `char(4)` — never derived by decrypting.

---

## API Reference

### `createFieldEncryptionService(config: EncryptionConfig): FieldEncryptionService`

Factory function. Validates config with Zod, constructs internal services, returns the orchestrator. Call once at startup.

### `FieldEncryptionService`

#### `encryptField(plaintext: string, context: EncryptionContext): Promise<EncryptedFieldResult>`

Primary write path. Returns:

```typescript
interface EncryptedFieldResult {
  ciphertext: Buffer;    // → bytea column
  blindIndex: string;    // → char(64) column (HMAC-SHA256 hex)
  lastFour: string;      // → char(4) column
  keyId: string;         // → varchar column (KMS key ARN)
  encryptedAt: Date;     // → timestamptz column
}
```

#### `decryptField(input: { ciphertext: Buffer }, context: EncryptionContext): Promise<string>`

Decrypts and verifies AAD context. Throws if context doesn't match.

#### `lookupHashes(plaintext: string): string[]`

Returns blind index hashes for lookups. Single-element array normally; two elements during HMAC rotation. Use with `WHERE column_hashed = ANY($1)`.

**This method is synchronous** — no KMS calls.

#### `isHmacRotating(): boolean`

Returns `true` if a previous HMAC key is configured (rotation in progress).

### Utility Functions

#### `mapEncryptedFieldToColumns(result: EncryptedFieldResult, prefix: string): Record<string, unknown>`

Maps a result to column-named keys:

```typescript
mapEncryptedFieldToColumns(result, 'tax_id')
// → { tax_id, tax_id_hashed, tax_id_last4, encryption_key_id, encrypted_at }
```

#### `mapMultipleEncryptedFields(fields: Array<{ result, prefix }>): Record<string, unknown>`

Maps multiple encrypted fields to a single flat object. Shared columns (`encryption_key_id`, `encrypted_at`) are taken from the last result.

#### `extractLastFour(value: string): string`

Strips non-alphanumeric chars, returns last 4. Throws if no alphanumeric chars present.

#### `toSdkEncryptionContext(ctx: EncryptionContext): Record<string, string>`

Converts typed context to the `Record<string, string>` the AWS SDK expects.

---

## Database Column Patterns

Every table with encrypted data follows this pattern:

| Column | Postgres Type | Source | Purpose |
|--------|--------------|--------|---------|
| `{prefix}` | `bytea` | `result.ciphertext` | Encrypted value (SDK message blob) |
| `{prefix}_hashed` | `char(64)` | `result.blindIndex` | HMAC-SHA256 blind index for lookups |
| `{prefix}_last4` | `char(4)` | `result.lastFour` | Masked display ("****6789") |
| `encryption_key_id` | `varchar(50)` | `result.keyId` | KMS key ARN — for key rotation queries |
| `encrypted_at` | `timestamptz` | `result.encryptedAt` | Audit timestamp |

### Example Tables

```sql
-- agent_companies
tax_id                bytea
tax_id_hashed         char(64)
tax_id_last4          char(4)
encryption_key_id     varchar(50)
encrypted_at          timestamptz

-- agent_taxes
tax_id_type           enum ('SSN', 'EIN', 'ITIN')  -- plaintext, not sensitive
type_value            bytea
type_value_hashed     char(64)
type_value_last4      char(4)
encryption_key_id     varchar(50)
encrypted_at          timestamptz

-- agent_bank_accounts
account_number        bytea
account_number_hashed char(64)
account_number_last4  char(4)
routing_number        bytea
account_holder_name   bytea
account_type          enum ('checking', 'savings')  -- plaintext
institution_name      varchar                        -- plaintext, for UI
encryption_key_id     varchar(50)
encrypted_at          timestamptz
```

### Indexing

```sql
-- B-tree index on blind index columns for exact-match lookups
CREATE INDEX idx_agent_companies_tax_id_hash ON agent_companies (tax_id_hashed);
CREATE INDEX idx_agent_taxes_type_value_hash ON agent_taxes (type_value_hashed);
CREATE INDEX idx_agent_bank_accounts_acct_hash ON agent_bank_accounts (account_number_hashed);
```

---

## Usage Examples

### Encrypting a Field

```typescript
import { createFieldEncryptionService } from '@exprealty/encryption';

const encryption = createFieldEncryptionService({
  kms: {
    keyArn: 'arn:aws:kms:us-east-1:123456789012:alias/exprealty-pii',
    region: 'us-east-1',
  },
  hmac: {
    current: process.env.HMAC_SECRET_CURRENT!,
  },
});

const result = await encryption.encryptField('123-45-6789', {
  tableName: 'agent_taxes',
  recordId: 'uuid-of-the-row',
  fieldName: 'type_value',
});

// result.ciphertext    → Buffer  → store in type_value column
// result.blindIndex    → string  → store in type_value_hashed column
// result.lastFour      → "6789"  → store in type_value_last4 column
// result.keyId         → string  → store in encryption_key_id column
// result.encryptedAt   → Date    → store in encrypted_at column
```

### Decrypting a Field

```typescript
const plaintext = await encryption.decryptField(
  { ciphertext: row.type_value },  // Buffer from the database
  {
    tableName: 'agent_taxes',
    recordId: row.id,
    fieldName: 'type_value',
  },
);
// plaintext === '123-45-6789'
```

### Looking Up by Plaintext Value

```typescript
const hashes = encryption.lookupHashes('123-45-6789');

// Normal: hashes = ['a1b2c3...']  (1 element)
// During HMAC rotation: hashes = ['a1b2c3...', 'x9y8z7...']  (2 elements)

const row = await repo.findOne({
  where: { type_value_hashed: In(hashes) },
});
```

### Using the Field Mapper

```typescript
import { mapEncryptedFieldToColumns } from '@exprealty/encryption';

const encrypted = await encryption.encryptField(taxId, context);
const columns = mapEncryptedFieldToColumns(encrypted, 'tax_id');
Object.assign(company, columns);
await repo.save(company);
```

### Multiple Fields on One Row

```typescript
import { mapMultipleEncryptedFields } from '@exprealty/encryption';

const encAccount = await encryption.encryptField(accountNumber, {
  tableName: 'agent_bank_accounts', recordId: id, fieldName: 'account_number',
});
const encRouting = await encryption.encryptField(routingNumber, {
  tableName: 'agent_bank_accounts', recordId: id, fieldName: 'routing_number',
});
const encHolder = await encryption.encryptField(holderName, {
  tableName: 'agent_bank_accounts', recordId: id, fieldName: 'account_holder_name',
});

const columns = mapMultipleEncryptedFields([
  { result: encAccount, prefix: 'account_number' },
  { result: encRouting, prefix: 'routing_number' },
  { result: encHolder, prefix: 'account_holder_name' },
]);
Object.assign(bankAccount, columns);
```

### NestJS Provider Registration

```typescript
// In your NestJS module
{
  provide: 'FIELD_ENCRYPTION',
  useFactory: async (config: ConfigService) =>
    createFieldEncryptionService({
      kms: {
        keyArn: await config.get('KMS_KEY_ARN'),
        region: await config.get('AWS_REGION'),
      },
      hmac: {
        current: await config.get('HMAC_SECRET_CURRENT'),
        previous: await config.get('HMAC_SECRET_PREVIOUS'), // undefined if not rotating
      },
    }),
  inject: [ConfigService],
}

// In your service
@Injectable()
class AgentTaxService {
  constructor(
    @Inject('FIELD_ENCRYPTION')
    private readonly encryption: FieldEncryptionService,
  ) {}
}
```

---

## HMAC Key Rotation

HMAC rotation is NOT automatic — it is a manual, multi-step process.

### Why HMAC Rotation is Different from KMS Rotation

KMS key rotation is transparent: the encrypted DEK travels with the ciphertext, so old data decrypts fine after rotation.

HMAC is different: `HMAC("123-45-6789", oldKey)` ≠ `HMAC("123-45-6789", newKey)`. After rotating, every blind index in the database is unsearchable unless you rehash.

### Rotation Process

**Step 1: Deploy with both keys**

```typescript
hmac: {
  current: 'NEW-SECRET-HERE',
  previous: 'OLD-SECRET-HERE',
}
```

At this point:
- New writes hash with `current` (new key)
- Lookups query with BOTH hashes → finds records hashed with either key
- `isHmacRotating()` returns `true`

**Step 2: Run background migration**

Iterate all rows, decrypt, rehash with the current key:

```typescript
for (const row of allRows) {
  const plaintext = await encryption.decryptField(
    { ciphertext: row.type_value },
    { tableName: '...', recordId: row.id, fieldName: 'type_value' },
  );
  const newHash = encryption.lookupHashes(plaintext)[0]; // current key only
  await repo.update(row.id, { type_value_hashed: newHash });
}
```

**Step 3: Remove previous key**

```typescript
hmac: {
  current: 'NEW-SECRET-HERE',
  // previous: removed
}
```

Now `lookupHashes()` returns a single-element array again.

---

## KMS Key Rotation

### Automatic Rotation (Recommended)

Enable automatic rotation on your KMS CMK in AWS. The SDK handles everything:

- Old ciphertexts include the encrypted DEK → KMS can decrypt with any previous key version
- New encryptions automatically use the latest key version
- No re-encryption needed
- No code changes needed

### Manual Re-encryption (If Required)

If compliance requires re-encrypting old data with the latest key:

```sql
-- Find records encrypted with old key
SELECT id FROM agent_taxes WHERE encryption_key_id = 'old-arn';
```

Then decrypt and re-encrypt each:

```typescript
const plaintext = await encryption.decryptField({ ciphertext: row.type_value }, context);
const reEncrypted = await encryption.encryptField(plaintext, context);
await repo.update(row.id, mapEncryptedFieldToColumns(reEncrypted, 'type_value'));
```

The `encryption_key_id` column tells you which key version encrypted each row.

---

## Testing

### Test Setup

Tests use Jest with ts-jest. The `EnvelopeService` is mocked in unit tests to avoid KMS calls.

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

### Test Files

| File | Tests |
|------|-------|
| `hmac.service.spec.ts` | Determinism, different inputs/keys, rotation (current+previous), deduplication |
| `last4.spec.ts` | SSN, EIN, ITIN, bank accounts, routing numbers, edge cases (empty, short, special chars) |
| `field-mapper.spec.ts` | Single field mapping, multiple fields, Buffer preservation, shared columns |
| `field-encryption.service.spec.ts` | Orchestration with mocked KMS, context passing, tenantId, blind index consistency |
| `encryption.config.spec.ts` | Zod validation: valid config, defaults, required fields, min lengths, invalid values |

### Mocking EnvelopeService

For unit tests that don't need real KMS:

```typescript
function createMockEnvelope(): EnvelopeService {
  return {
    encryptValue: jest.fn().mockResolvedValue(Buffer.from('mock-ciphertext')),
    decryptValue: jest.fn().mockResolvedValue('123-45-6789'),
    getKeyId: jest.fn().mockReturnValue('arn:aws:kms:us-east-1:123456789012:alias/test'),
  } as unknown as EnvelopeService;
}
```

### Integration Tests (Real KMS)

Not included in this package. To test with real KMS:

1. Set up a KMS key in a test AWS account
2. Set `KMS_KEY_ARN` and `AWS_REGION` environment variables
3. Use the real `EnvelopeService` (do not mock)
4. Verify round-trip: encrypt → decrypt → original plaintext

---

## Troubleshooting

### `AccessDeniedException: kms:GenerateDataKey`

The IAM role/user needs `kms:GenerateDataKey` permission on the CMK for encryption, and `kms:Decrypt` for decryption.

### `Encryption context mismatch`

The context passed to `decryptField()` does not match what was used during encryption. This means either:
- Wrong `recordId` (most common — the row's primary key changed or you're passing the wrong ID)
- Wrong `tableName` or `fieldName`
- Someone copied encrypted data between rows (the AAD protection is working correctly)

### `HMAC secret must be at least 32 characters`

Zod validation failed on startup. The HMAC secret in your config is too short. Must be >= 32 characters.

### Blind index lookup returns no results

If you recently rotated HMAC keys and forgot to include the `previous` key, records hashed with the old key will not be found. Add the old key as `previous` in the config and run the rehash migration.

### `Cannot extract last four: value contains no alphanumeric characters`

The plaintext passed to `encryptField()` has no letters or numbers after stripping formatting characters. This is likely a data quality issue upstream.

### `ciphertext` column is empty or null

Check that the `encryptField()` result's `ciphertext` Buffer is being persisted correctly. TypeORM needs the column typed as `bytea`. If the column is `text`, you need to base64-encode the Buffer before saving (not recommended — use `bytea`).

---

## Design Decisions

### Why no NestJS dependency?

The encryption package is infrastructure. It needs to work in NestJS services, standalone migration scripts, Lambda functions, CLI tools, and future services that may not use NestJS. Framework coupling would limit reuse.

### Why no TypeORM dependency?

Same reason. Column mapping is a UI concern — each consuming entity has different column names. The `mapEncryptedFieldToColumns()` utility returns a plain object that works with any ORM or raw SQL. If you want a `@EncryptedColumn()` decorator, build a separate `@exprealty/encryption-typeorm` package.

### Why `bytea` over `text` for ciphertext?

The AWS Encryption SDK output is binary. Base64-encoding into `text` inflates storage ~33% with no benefit. Postgres handles `bytea` natively.

### Why `char(64)` over `text` for blind indexes?

HMAC-SHA256 hex output is always exactly 64 characters. Fixed-width column gives implicit length validation and marginally better index performance.

### Why separate HMAC key from encryption key?

Defense in depth. If the KMS key is compromised, the attacker can decrypt data but cannot generate valid blind indexes (and vice versa). Two separate secrets, two separate compromise paths.

### Why AAD encryption context?

Without it, an attacker (or a bug) could copy encrypted data from one row to another and it would decrypt successfully. With AAD, the ciphertext is cryptographically bound to its specific table + record + field. Moving it causes decryption to fail.

### Why no per-column encryption keys?

One DEK per row, not per column. Per-column keys would mean N KMS calls per row write (expensive) and N key IDs to track. The blast radius difference between per-row and per-column is minimal — if a row's DEK leaks, the attacker gets all columns in that row either way.

### Why inline HmacConfigSchema instead of a separate file?

The HMAC config is small (2 fields) and only used by the parent `EncryptionConfigSchema`. A separate file would add import complexity for no meaningful separation of concerns. The type is accessed via `EncryptionConfig['hmac']` — no separate export needed.

---

## File-by-File Reference

This section provides a quick reference of what each file does, its imports, and its exports. Use this for debugging import issues or understanding the dependency graph.

### `src/config/encryption.config.ts`

**Imports**: `zod`
**Exports**: `EncryptionConfigSchema` (Zod object), `EncryptionConfig` (type)
**Does NOT export**: `HmacConfigSchema` (local const), `HmacConfig`/`HmacSecrets` (no such type)
**Key detail**: HMAC sub-type is accessed as `EncryptionConfig['hmac']` by consumers

### `src/services/envelope.service.ts`

**Imports**: `@aws-crypto/client-node` (`KmsKeyringNode`, `buildClient`, `CommitmentPolicy`)
**Exports**: `EnvelopeService` class
**Constructor**: `(kmsKeyArn: string, region: string)`
**Methods**:
- `encryptValue(plaintext: string, encryptionContext: Record<string, string>): Promise<Buffer>`
- `decryptValue(ciphertext: Buffer, expectedContext: Record<string, string>): Promise<string>`
- `getKeyId(): string`

### `src/services/hmac.service.ts`

**Imports**: Node `crypto`, `EncryptionConfig` type from config
**Exports**: `HmacService` class
**Constructor**: `(secrets: EncryptionConfig['hmac'])`
**Methods**:
- `hash(plaintext: string): string` — current key only, for writes
- `hashForLookup(plaintext: string): string[]` — current + previous, for reads
- `isRotating(): boolean`

### `src/services/field-encryption.service.ts`

**Imports**: `EnvelopeService`, `HmacService`, `extractLastFour`, types
**Exports**: `FieldEncryptionService` class
**Constructor**: `(envelope: EnvelopeService, hmac: HmacService)`
**Methods**:
- `encryptField(plaintext: string, context: EncryptionContext): Promise<EncryptedFieldResult>`
- `decryptField(input: { ciphertext: Buffer }, context: EncryptionContext): Promise<string>`
- `lookupHashes(plaintext: string): string[]`
- `isHmacRotating(): boolean`

### `src/types/encryption-context.types.ts`

**Imports**: none
**Exports**: `EncryptionContext` (interface), `toSdkEncryptionContext()` (function)

### `src/types/encrypted-field.types.ts`

**Imports**: none
**Exports**: `EncryptedFieldResult` (interface)

### `src/utils/last4.ts`

**Imports**: none
**Exports**: `extractLastFour(value: string): string`

### `src/utils/field-mapper.ts`

**Imports**: `EncryptedFieldResult` type
**Exports**: `mapEncryptedFieldToColumns()`, `mapMultipleEncryptedFields()`

### `src/factory.ts`

**Imports**: `EncryptionConfigSchema`, `EncryptionConfig`, `EnvelopeService`, `HmacService`, `FieldEncryptionService`
**Exports**: `createFieldEncryptionService(raw: EncryptionConfig): FieldEncryptionService`
**Key detail**: Accesses config as `config.kms.keyArn`, `config.kms.region`, `config.hmac`

### `src/index.ts`

**Re-exports everything**:
- `createFieldEncryptionService` from factory
- `FieldEncryptionService`, `EnvelopeService`, `HmacService` from services
- `EncryptionConfigSchema`, `EncryptionConfig` type from config
- `EncryptedFieldResult`, `EncryptionContext` types
- `toSdkEncryptionContext` from types
- `extractLastFour` from utils
- `mapEncryptedFieldToColumns`, `mapMultipleEncryptedFields` from utils

---

## Versioning Policy

This package follows [Semantic Versioning](https://semver.org/).

### What constitutes a breaking change (major bump)

- Removing or renaming any export from `index.ts`
- Changing the shape of `EncryptionConfig` (fields required by `createFieldEncryptionService()`)
- Changing the shape of `EncryptedFieldResult` (affects column mapping)
- Changing the shape of `EncryptionContext` (affects AAD — would break decryption of existing data)
- Changing the ciphertext wire format (would break decryption of existing data)
- Changing HMAC output for the same input (would break blind index lookups)

### What is a minor bump

- Adding new exports, methods, or optional config fields
- Adding new error classes
- New utility functions

### What is a patch bump

- Bug fixes that don't change public API behavior
- Documentation updates
- Internal refactors with no API surface changes

### Changelog

All changes are documented in [CHANGELOG.md](./CHANGELOG.md).