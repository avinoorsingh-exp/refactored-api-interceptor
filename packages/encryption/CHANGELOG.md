# Changelog

All notable changes to `@exprealty/encryption` will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-02-23

### Added

- `EncryptionEnvSchema` in `@exprealty/config` — Zod schema for `KMS_KEY_ARN`, `KMS_KEY_REGION`, `KMS_CACHE_TTL_SECONDS`, `KMS_CACHE_MAX_MESSAGES`. Services opt in by merging into their `ConfigSchema`.

### Changed

- `createFieldEncryptionService()` factory now accepts optional `cacheTtlSeconds` and `cacheMaxMessages` in the `kms` config block for data key caching.
- `FieldEncryptionService.encryptField()` result now includes `encryptionVersion: 1` — version tag for the encryption scheme registry (see ADR-PII-001 section 2).

### Integration (agent-service)

These changes are in `@exprealty/agent-service`, not in the encryption package itself, but are documented here for completeness:

- **SharedEncryptionModule**: Global NestJS module providing `FIELD_ENCRYPTION` (full `FieldEncryptionService`) and `TaxIdHasher` (thin adapter) tokens. Replaces per-module `taxIdHasherProvider`.
- **KMS wiring**: `AgentCompanyService` and `AgentTaxService` now call `encryptField()` on every create/update. All six encryption columns populated.
- **UUID pre-generation**: `randomUUID()` generates the record ID before `encryptField()` to bind ciphertext to a specific row via AAD.
- **Version-aware decrypt**: `decryptTaxId()` / `decryptTypeValue()` repository methods dispatch to Mendix v0 or KMS v1 based on `encryption_version`.
- **Mendix v0 decrypt**: `decryptMendixV0()` utility for AES-128-CBC `{AES3}` format using `HMAC_SECRET` as passphrase (best-effort, returns null on failure).
- **Startup health log**: `OnModuleInit` logs active encryption mode and HMAC rotation status.

---

## [0.1.0] - 2026-02-23

Initial release — workspace-only. Not yet published to CodeArtifact.

### Added

- `createFieldEncryptionService()` — production factory (KMS-backed)
- `createLocalFieldEncryptionService()` — local/test factory (in-process AES-256-GCM, no KMS)
- `FieldEncryptionService` — orchestrator: encrypt, decrypt, blind index, last-4
- `EnvelopeService` — AWS KMS envelope encryption (AES-256-GCM via `@aws-crypto/client-node` v4)
- `LocalEnvelopeService` — in-process AES-256-GCM for local development and testing
- `HmacService` — HMAC-SHA256 blind indexing with rotation support (`current` + `previous` keys)
- `IEnvelopeService` — interface contract for envelope services
- `EncryptionConfigSchema` — Zod config validation
- `mapEncryptedFieldToColumns()` / `mapMultipleEncryptedFields()` — column mapping utilities
- `extractLastFour()` — masked display value extraction
- Typed error classes: `EncryptionError`, `DecryptionError`, `ContextMismatchError`, `KeyNotFoundError`, `InvalidInputError`
