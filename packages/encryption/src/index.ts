import { EncryptionConfigSchema, type EncryptionConfig } from './config/encryption.config.js';
import { EnvelopeService } from './services/envelope.service.js';
import { LocalEnvelopeService } from './services/local-envelope.service.js';
import { HmacService } from './services/hmac.service.js';
import { FieldEncryptionService } from './services/field-encryption.service.js';

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a configured FieldEncryptionService instance.
 *
 * This is the primary entry point for @exprealty/encryption.
 * Validates configuration with Zod and constructs all internal services.
 *
 * @example NestJS provider
 * ```typescript
 * {
 *   provide: 'FIELD_ENCRYPTION',
 *   useFactory: async (config: ConfigService) =>
 *     createFieldEncryptionService({
 *       kms: {
 *         keyArn: await config.get('KMS_KEY_ARN'),
 *         region: await config.get('AWS_REGION'),
 *       },
 *       hmac: {
 *         current: await config.get('HMAC_SECRET'),
 *       },
 *     }),
 *   inject: [ConfigService],
 * }
 * ```
 *
 * @example Standalone (Lambda, CLI, migration script)
 * ```typescript
 * const encryption = createFieldEncryptionService({
 *   kms: { keyArn: process.env.KMS_KEY_ARN!, region: 'us-east-1' },
 *   hmac: { current: process.env.HMAC_SECRET! },
 * });
 *
 * const result = await encryption.encryptField('123-45-6789', {
 *   tableName: 'agent_taxes',
 *   recordId: 'abc-123',
 *   fieldName: 'type_value',
 * });
 * ```
 *
 * @param raw - Configuration object (validated at runtime)
 * @returns Configured FieldEncryptionService
 * @throws {ZodError} If configuration is invalid
 */
export function createFieldEncryptionService(
  raw: EncryptionConfig,
): FieldEncryptionService {
  const config = EncryptionConfigSchema.parse(raw);

  const envelope = new EnvelopeService(
    config.kms.keyArn,
    config.kms.region,
    config.kms.cacheTtlSeconds,
    config.kms.cacheMaxMessages,
  );

  const hmac = new HmacService(config.hmac);

  return new FieldEncryptionService(envelope, hmac);
}

/**
 * Creates a FieldEncryptionService backed by in-process AES-256-GCM.
 * For local development and unit testing ONLY. Never use in staging or prod.
 *
 * @param hmacSecret - HMAC secret (min 32 chars). Also used to derive the local encryption key.
 * @returns Configured FieldEncryptionService using local encryption (no KMS)
 * @throws If NODE_ENV is not 'local', 'development', or 'test'
 */
export function createLocalFieldEncryptionService(
  hmacSecret: string,
): FieldEncryptionService {
  const allowedEnvs = ['local', 'development', 'test'];
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (!allowedEnvs.includes(nodeEnv)) {
    throw new Error(
      `createLocalFieldEncryptionService() is only allowed in ${allowedEnvs.join('/')} environments. ` +
        `Current NODE_ENV: "${nodeEnv}". Use createFieldEncryptionService() with KMS for production.`,
    );
  }

  const envelope = new LocalEnvelopeService(hmacSecret);
  const hmac = new HmacService({ current: hmacSecret });

  return new FieldEncryptionService(envelope, hmac);
}

// ─── Config ─────────────────────────────────────────────────────────────────

export { type HmacConfig, EncryptionConfigSchema, type EncryptionConfig } from './config/encryption.config.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type { EncryptedFieldResult } from './types/encrypted-field.types.js';
export type { EncryptionContext } from './types/encryption-context.types.js';
export type { IEnvelopeService } from './types/envelope-service.types.js';

// ─── Utils ──────────────────────────────────────────────────────────────────

export { extractLastFour } from './utils/last4.js';
export { mapEncryptedFieldToColumns, type ColumnMap } from './utils/field-mapper.js';

// ─── Errors ──────────────────────────────────────────────────────────────────

export {
  EncryptionError,
  DecryptionError,
  ContextMismatchError,
  KeyNotFoundError,
  InvalidInputError,
} from './errors/encryption-errors.js';

// ─── Services (for advanced usage / testing) ────────────────────────────────

export { FieldEncryptionService } from './services/field-encryption.service.js';
export { EnvelopeService } from './services/envelope.service.js';
export { LocalEnvelopeService } from './services/local-envelope.service.js';
export { HmacService } from './services/hmac.service.js';