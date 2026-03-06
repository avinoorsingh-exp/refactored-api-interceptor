import type { EncryptionContext } from './encryption-context.types.js';

/**
 * Contract for envelope encryption services.
 * Implemented by both EnvelopeService (KMS) and LocalEnvelopeService (in-process).
 */
export interface IEnvelopeService {
  encryptValue(
    plaintext: string,
    context: EncryptionContext,
  ): Promise<{ ciphertext: Buffer; keyId: string }>;

  decryptValue(
    ciphertext: Buffer,
    context: EncryptionContext,
  ): Promise<string>;

  getKeyId(): string;
}
