import { LocalEnvelopeService } from '../src/services/local-envelope.service.js';
import type { EncryptionContext } from '../src/types/encryption-context.types.js';
import { TEST_HMAC_SECRET_CURRENT } from './fixtures/test-keys.js';

const TEST_CONTEXT: EncryptionContext = {
  tableName: 'agent_taxes',
  recordId: 'uuid-abc-123',
  fieldName: 'type_value',
};

describe('LocalEnvelopeService', () => {
  let service: LocalEnvelopeService;

  beforeEach(() => {
    service = new LocalEnvelopeService(TEST_HMAC_SECRET_CURRENT);
  });

  describe('round-trip encrypt → decrypt', () => {
    it('should decrypt to the original plaintext', async () => {
      const plaintext = '123-45-6789';
      const { ciphertext } = await service.encryptValue(plaintext, TEST_CONTEXT);
      const result = await service.decryptValue(ciphertext, TEST_CONTEXT);

      expect(result).toBe(plaintext);
    });

    it('should handle empty string', async () => {
      const { ciphertext } = await service.encryptValue('', TEST_CONTEXT);
      const result = await service.decryptValue(ciphertext, TEST_CONTEXT);

      expect(result).toBe('');
    });

    it('should handle unicode characters', async () => {
      const plaintext = 'José García — ID: 12345';
      const { ciphertext } = await service.encryptValue(plaintext, TEST_CONTEXT);
      const result = await service.decryptValue(ciphertext, TEST_CONTEXT);

      expect(result).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext (random IV)', async () => {
      const { ciphertext: ct1 } = await service.encryptValue('123-45-6789', TEST_CONTEXT);
      const { ciphertext: ct2 } = await service.encryptValue('123-45-6789', TEST_CONTEXT);

      expect(ct1.equals(ct2)).toBe(false);
    });
  });

  describe('AAD context verification', () => {
    it('should fail to decrypt with a different recordId', async () => {
      const { ciphertext } = await service.encryptValue('123-45-6789', TEST_CONTEXT);

      await expect(
        service.decryptValue(ciphertext, { ...TEST_CONTEXT, recordId: 'wrong-id' }),
      ).rejects.toThrow();
    });

    it('should fail to decrypt with a different tableName', async () => {
      const { ciphertext } = await service.encryptValue('123-45-6789', TEST_CONTEXT);

      await expect(
        service.decryptValue(ciphertext, { ...TEST_CONTEXT, tableName: 'wrong_table' }),
      ).rejects.toThrow();
    });

    it('should fail to decrypt with a different fieldName', async () => {
      const { ciphertext } = await service.encryptValue('123-45-6789', TEST_CONTEXT);

      await expect(
        service.decryptValue(ciphertext, { ...TEST_CONTEXT, fieldName: 'wrong_field' }),
      ).rejects.toThrow();
    });
  });

  describe('key isolation', () => {
    it('should fail to decrypt with a different key', async () => {
      const other = new LocalEnvelopeService('a-completely-different-secret-key-here-32-chars');
      const { ciphertext } = await service.encryptValue('123-45-6789', TEST_CONTEXT);

      await expect(
        other.decryptValue(ciphertext, TEST_CONTEXT),
      ).rejects.toThrow();
    });
  });

  describe('getKeyId', () => {
    it('should return local-dev-key', () => {
      expect(service.getKeyId()).toBe('local-dev-key');
    });
  });

  describe('encryptValue return shape', () => {
    it('should return ciphertext Buffer and keyId string', async () => {
      const result = await service.encryptValue('123-45-6789', TEST_CONTEXT);

      expect(Buffer.isBuffer(result.ciphertext)).toBe(true);
      expect(typeof result.keyId).toBe('string');
    });
  });
});
