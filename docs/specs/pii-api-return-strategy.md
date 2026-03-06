# PII API Return Strategy

> Status: **Approved** — Sprint 1 Feature Branch

## Overview

This document defines the API response shape for PII-encrypted fields (tax IDs) across
both v0 (Mendix legacy) and v1 (KMS envelope) encryption versions. The API surface is
**uniform** — consumers see the same shape regardless of the underlying encryption version.

## Decision

**Encryption version is internal** — never exposed via API responses.

Both v0 and v1 records produce the same `last4` + `hashed` (HMAC blind index) columns
during write or migration. API consumers only see:

| API Field        | Source Column          | Example              | Description                        |
|------------------|------------------------|----------------------|------------------------------------|
| `value` (Tax)    | `type_last4`           | `*****6789`          | Masked display: `*****` + last 4   |
| `valueToken`     | `type_hashed`          | `a1b2c3...` (64 hex) | HMAC-SHA256 blind index            |
| `taxId` (Company)| `tax_id_last4`         | `*****1234`          | Masked display: `*****` + last 4   |
| `taxIdToken`     | `tax_id_hashed`        | `a1b2c3...` (64 hex) | HMAC-SHA256 blind index            |

## Response Shapes

### Tax (nested in AgentTax)

```json
{
  "id": "uuid",
  "taxIdType": "SSN",
  "value": "*****6789",
  "valueToken": "a1b2c3d4...64-char-hex",
  "created": "2024-01-15T10:00:00Z",
  "lastModified": "2024-01-15T10:00:00Z",
  "modifiedBy": "system"
}
```

### AgentCompany

```json
{
  "id": "uuid",
  "legacyId": "12345",
  "name": "Example Brokerage",
  "email": "contact@brokerage.com",
  "phone": "555-123-4567",
  "taxId": "*****1234",
  "taxIdToken": "a1b2c3d4...64-char-hex",
  "useSsn": false,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Write Flow (Current — HMAC-only, no envelope encryption yet)

1. API receives plaintext tax ID in `value` / `taxId` field
2. Service rejects masked placeholders (`*****NNNN` pattern)
3. Service computes:
   - `last4` = last 4 alphanumeric characters (via `extractLastFour`)
   - `hash` = HMAC-SHA256 blind index (via injected `TaxIdHasher`)
4. Repository persists `last4` + `hash` columns
5. Response returns masked display + HMAC token

## Future: Two-Phase Write (KMS Envelope Encryption)

When full encryption is enabled:

1. Insert row with `NULL` encryption columns → get UUID
2. Encrypt plaintext using UUID as AAD record ID
3. Update row with `ciphertext`, `last4`, `hash`, `key_id`, `encrypted_at`, `encryption_version = 1`

The API response shape does **not change** — still only `last4` + `hash` are returned.

## Null / Empty Handling

| Scenario                      | `value` / `taxId` | `valueToken` / `taxIdToken` |
|-------------------------------|--------------------|-----------------------------|
| Tax ID provided               | `*****6789`        | `a1b2c3...` (64 hex)        |
| Tax ID explicitly set to null | `null`             | `null`                      |
| Tax ID never set              | `""` / `null`      | `null`                      |
| V0 migrated (pre-HMAC)        | `*****6789`        | `a1b2c3...` (64 hex)        |

## HMAC Compatibility

The same HMAC secret is used for both v0 and v1 encryption versions.
Blind indexes are identical regardless of which encryption envelope was used.
This means:

- Search by HMAC token works across both versions
- No token rotation needed during Mendix → KMS migration
- `tokenizeTaxIdCandidates` (with `previousSecret` fallback) handles secret rotation if needed

## Internal-Only Fields (NOT in API)

These columns exist in the database but are **never** returned by the API:

| Column             | Type      | Purpose                                    |
|--------------------|-----------|--------------------------------------------|
| `type_value`       | `BYTEA`   | Encrypted ciphertext (KMS envelope)        |
| `tax_id`           | `BYTEA`   | Encrypted ciphertext (KMS envelope)        |
| `encryption_key_id`| `TEXT`     | KMS key ARN used for encryption            |
| `encrypted_at`     | `TIMESTAMPTZ` | When encryption occurred                |
| `encryption_version`| `SMALLINT`| 0 = Mendix, 1 = KMS                       |
