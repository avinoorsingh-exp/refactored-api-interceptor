# PII Tax ID Migration Notes

## Overview

Migration `1770800000000-AddEncryptedPiiColumns` replaces plaintext tax ID columns with envelope-encryption columns on the `core.tax` and `core.agent_company` tables.

Old columns (`value`/`value_hashed` on tax, `tax_id`/`tax_id_hashed` on agent_company) are dropped and replaced with properly-typed columns.

## New Columns

### `core.tax`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `type_value` | `BYTEA` | Yes | AES-256-GCM ciphertext of the tax ID type value |
| `type_hashed` | `CHAR(64)` | Yes | HMAC-SHA256 blind index (hex) |
| `type_last4` | `CHAR(4)` | Yes | Last 4 digits for masked display |
| `encryption_key_id` | `VARCHAR(256)` | Yes | DEK/key-version identifier |
| `encryption_version` | `SMALLINT` | Yes | Encryption scheme version (1 = AES-256-GCM via @aws-crypto v4) |
| `encrypted_at` | `TIMESTAMPTZ` | Yes | When encryption occurred |

### `core.agent_company`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `tax_id` | `BYTEA` | Yes | AES-256-GCM ciphertext of the full tax ID |
| `tax_id_hashed` | `CHAR(64)` | Yes | HMAC-SHA256 blind index (hex) |
| `tax_id_last4` | `CHAR(4)` | Yes | Last 4 digits for masked display |
| `encryption_key_id` | `VARCHAR(256)` | Yes | DEK/key-version identifier |
| `encryption_version` | `SMALLINT` | Yes | Encryption scheme version (1 = AES-256-GCM via @aws-crypto v4) |
| `encrypted_at` | `TIMESTAMPTZ` | Yes | When encryption occurred |

## Constraints

- `CHK_tax_type_last4`: `type_last4 ~ '^[0-9]{4}$'` when not null
- `CHK_tax_type_hashed`: `type_hashed ~ '^[0-9a-f]{64}$'` when not null
- `CHK_agent_company_tax_id_last4`: `tax_id_last4 ~ '^[0-9]{4}$'` when not null
- `CHK_agent_company_tax_id_hashed`: `tax_id_hashed ~ '^[0-9a-f]{64}$'` when not null

## Indexes

- `IDX_tax_type_hashed` -- btree on `core.tax.type_hashed`
- `IDX_agent_company_tax_id_hashed` -- btree on `core.agent_company.tax_id_hashed`

## Current State

All new columns are **nullable** and **empty**. The application layer writes `last4` and `HMAC token` on create/update via the service layer. Encryption columns (`type_value`/`tax_id`, `encryption_key_id`, `encryption_version`, `encrypted_at`) will be populated when the encryption layer is wired up. The `core.tax` table uses `type_value` / `type_hashed` / `type_last4` naming (since `tax_id` is the FK in other tables). The `core.agent_company` table uses `tax_id` / `tax_id_hashed` / `tax_id_last4`.

## Encryption Plan

1. **Current** -- Service layer computes last4 + HMAC token; writes to `*_last4` and `*_hashed` columns
2. **Encryption wiring** -- Update service layer to also encrypt+write `type_value`/`tax_id` with key metadata
3. **Full coverage** -- All rows have encrypted columns populated, `*_last4` and `*_hashed` are derived on write
