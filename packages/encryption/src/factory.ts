import { EncryptionConfigSchema, type EncryptionConfig } from './config/encryption.config.js';
import { EnvelopeService } from './services/envelope.service.js';
import { HmacService } from './services/hmac.service.js';
import { FieldEncryptionService } from './services/field-encryption.service.js';

/**
 * Creates a fully configured FieldEncryptionService.
 *
 * This is the main entry point for the package. It:
 *   1. Validates the config with Zod (throws immediately if invalid)
 *   2. Constructs the EnvelopeService (KMS keyring)
 *   3. Constructs the HmacService (blind indexing)
 *   4. Wires them into the FieldEncryptionService orchestrator
 *
 * The returned service is stateless and safe to reuse across requests.
 * Construct it once at app startup and inject/pass it where needed.
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
 *         previous: await config.get('HMAC_SECRET_PREVIOUS'), // optional
 *       },
 *     }),
 *   inject: [ConfigService],
 * }
 * ```
 *
 * @example Standalone script
 * ```typescript
 * const encryption = createFieldEncryptionService({
 *   kms: { keyArn: process.env.KMS_KEY_ARN!, region: 'us-east-1' },
 *   hmac: { current: process.env.HMAC_SECRET! },
 * });
 * ```
 *
 * @param raw - Unvalidated config object
 * @returns A configured FieldEncryptionService instance
 * @throws {ZodError} If config validation fails
 */
export function createFieldEncryptionService(
  raw: EncryptionConfig,
): FieldEncryptionService {
  const config = EncryptionConfigSchema.parse(raw);

  const envelope = new EnvelopeService(config.kms.keyArn, config.kms.region);
  const hmac = new HmacService(config.hmac);

  return new FieldEncryptionService(envelope, hmac);
}