import {
  buildClient,
  CommitmentPolicy,
  KmsKeyringNode,
  NodeCachingMaterialsManager,
  getLocalCryptographicMaterialsCache,
} from '@aws-crypto/client-node';
import { toSdkEncryptionContext, type EncryptionContext } from '../types/encryption-context.types.js';

/**
 * Envelope encryption service using AWS KMS + AES-256-GCM via the AWS Encryption SDK.
 *
 * How envelope encryption works:
 * 1. SDK asks KMS to generate a Data Encryption Key (DEK)
 * 2. KMS returns plaintext DEK + encrypted DEK (wrapped by your CMK)
 * 3. SDK encrypts your data locally with the plaintext DEK (AES-256-GCM)
 * 4. SDK packages: encrypted DEK + IV + ciphertext + auth tag into one message
 * 5. Plaintext DEK is discarded from memory
 *
 * Key rotation:
 * - Rotate the CMK in KMS → new encryptions use new key material
 * - Old messages still decrypt because the encrypted DEK in each message
 *   references the specific CMK version that created it
 * - No re-encryption needed unless you want to retire old CMK versions
 */
export class EnvelopeService {
  private readonly encrypt: ReturnType<typeof buildClient>['encrypt'];
  private readonly decrypt: ReturnType<typeof buildClient>['decrypt'];
  private readonly keyring: KmsKeyringNode;
  private readonly cmm: NodeCachingMaterialsManager | undefined;
  private readonly keyArn: string;

  constructor(
    keyArn: string,
    region: string,
    cacheTtlSeconds?: number,
    cacheMaxMessages: number = 100,
  ) {
    this.keyArn = keyArn;

    // REQUIRE_ENCRYPT_REQUIRE_DECRYPT enforces key commitment on both sides.
    // Prevents ciphertext from being decryptable with multiple keys (commitment attack).
    const { encrypt, decrypt } = buildClient(
      CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT,
    );

    this.encrypt = encrypt;
    this.decrypt = decrypt;

    this.keyring = new KmsKeyringNode({
      generatorKeyId: keyArn,
      clientProvider: (awsRegion: string) => {
        // The SDK creates KMS clients internally.
        // If you need custom credentials, this is where you'd configure them.
        // For ECS/Lambda with IAM roles, the default credential chain works.
        return undefined as any; // SDK falls back to default credential provider
      },
    });

    // Optional: cache DEKs to reduce KMS API calls
    if (cacheTtlSeconds) {
      const cache = getLocalCryptographicMaterialsCache(cacheMaxMessages);

      this.cmm = new NodeCachingMaterialsManager({
        backingMaterials: this.keyring,
        cache,
        maxAge: cacheTtlSeconds * 1000, // SDK expects milliseconds
        maxMessagesEncrypted: cacheMaxMessages,
      });
    }
  }

  /**
   * Encrypt plaintext using envelope encryption.
   *
   * @param plaintext - The sensitive value to encrypt
   * @param context - AAD context bound to the ciphertext (table, record, field)
   * @returns Buffer containing the complete SDK encrypted message
   */
  async encryptValue(
    plaintext: string,
    context: EncryptionContext,
  ): Promise<{ ciphertext: Buffer; keyId: string }> {
    const sdkContext = toSdkEncryptionContext(context);

    const { result, messageHeader } = await this.encrypt(
      this.cmm ?? this.keyring,
      Buffer.from(plaintext, 'utf-8'),
      { encryptionContext: sdkContext },
    );

    const keyId =
      messageHeader.encryptedDataKeys[0]?.providerInfo ?? this.keyArn;

    return { ciphertext: result, keyId };
  }

  /**
   * Decrypt a previously encrypted message.
   *
   * @param ciphertext - The complete SDK encrypted message buffer
   * @param context - Must match the context used during encryption (AAD verification)
   * @returns The decrypted plaintext string
   * @throws If the encryption context doesn't match (tamper detection)
   */
  async decryptValue(
    ciphertext: Buffer,
    context: EncryptionContext,
  ): Promise<string> {
    const expectedContext = toSdkEncryptionContext(context);

    const { plaintext, messageHeader } = await this.decrypt(
      this.cmm ?? this.keyring,
      ciphertext,
    );

    // Verify the encryption context matches what we expect.
    // The SDK verifies integrity via the auth tag, but we also validate
    // the AAD context to catch misuse (e.g., wrong record ID passed in).
    const storedContext = messageHeader.encryptionContext;
    for (const [key, value] of Object.entries(expectedContext)) {
      if (storedContext[key] !== value) {
        throw new Error(
          `Encryption context mismatch: expected ${key}="${value}", ` +
            `got ${key}="${storedContext[key]}". ` +
            'This may indicate the ciphertext was moved between records.',
        );
      }
    }

    return plaintext.toString('utf-8');
  }

  /**
   * Returns the KMS key ARN/alias used by this service.
   * Stored alongside encrypted data for key rotation tracking.
   */
  getKeyId(): string {
    return this.keyArn;
  }
}