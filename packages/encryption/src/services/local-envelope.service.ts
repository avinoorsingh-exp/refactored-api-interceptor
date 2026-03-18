import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { toSdkEncryptionContext, type EncryptionContext } from '../types/encryption-context.types.js';
import { ContextMismatchError } from '../errors/encryption-errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
// 4-byte header: version (1) + reserved (3)
const HEADER_LENGTH = 4;
const HEADER_VERSION = 0x01;

/**
 * In-process AES-256-GCM envelope service for local development and testing.
 *
 * Implements the same interface as EnvelopeService but uses a locally-derived
 * key instead of AWS KMS. The ciphertext format is NOT compatible with
 * EnvelopeService — data encrypted here cannot be decrypted by KMS and vice versa.
 *
 * Never use in staging or production.
 */
export class LocalEnvelopeService {
  private readonly key: Buffer;
  private readonly keyId: string;

  constructor(secret: string) {
    // Derive a 256-bit key from the secret via SHA-256
    this.key = createHash('sha256').update(secret).digest();
    this.keyId = 'local-dev-key';
  }

  async encryptValue(
    plaintext: string,
    context: EncryptionContext,
  ): Promise<{ ciphertext: Buffer; keyId: string }> {
    const iv = randomBytes(IV_LENGTH);
    const aad = Buffer.from(JSON.stringify(toSdkEncryptionContext(context)));

    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: [header (4)] [iv (12)] [authTag (16)] [ciphertext (...)]
    const header = Buffer.alloc(HEADER_LENGTH);
    header[0] = HEADER_VERSION;

    const ciphertext = Buffer.concat([header, iv, authTag, encrypted]);
    return { ciphertext, keyId: this.keyId };
  }

  async decryptValue(
    ciphertext: Buffer,
    context: EncryptionContext,
  ): Promise<string> {
    const iv = ciphertext.subarray(HEADER_LENGTH, HEADER_LENGTH + IV_LENGTH);
    const authTag = ciphertext.subarray(
      HEADER_LENGTH + IV_LENGTH,
      HEADER_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const encrypted = ciphertext.subarray(HEADER_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    const expectedContext = toSdkEncryptionContext(context);
    const aad = Buffer.from(JSON.stringify(expectedContext));

    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  getKeyId(): string {
    return this.keyId;
  }
}
