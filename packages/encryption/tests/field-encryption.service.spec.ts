import { FieldEncryptionService } from '../src/services/field-encryption.service.js';
import { EnvelopeService } from '../src/services/envelope.service.js';
import { HmacService } from '../src/services/hmac.service.js';
import type { EncryptionContext } from '../src/types/encryption-context.types.js';

// Mock the EnvelopeService — we don't have KMS in unit tests
const mockEnvelope = {
  encryptValue: jest.fn(),
  decryptValue: jest.fn(),
  getKeyId: jest.fn(),
} as unknown as jest.Mocked<EnvelopeService>;

const TEST_SECRET = 'test-hmac-secret-at-least-32-characters-long-here';
const TEST_KEY_ARN = 'arn:aws:kms:us-east-1:123456789012:key/test-key-id';

const TEST_CONTEXT: EncryptionContext = {
  tableName: 'agent_taxes',
  recordId: 'uuid-abc-123',
  fieldName: 'type_value',
};

describe('FieldEncryptionService', () => {
  let service: FieldEncryptionService;
  let hmac: HmacService;

  beforeEach(() => {
    jest.clearAllMocks();

    hmac = new HmacService({ current: TEST_SECRET });

    (mockEnvelope.getKeyId as jest.Mock).mockReturnValue(TEST_KEY_ARN);
    (mockEnvelope.encryptValue as jest.Mock).mockResolvedValue({
      ciphertext: Buffer.from('mock-encrypted-data'),
      keyId: TEST_KEY_ARN,
    });
    (mockEnvelope.decryptValue as jest.Mock).mockResolvedValue('123-45-6789');

    service = new FieldEncryptionService(mockEnvelope, hmac);
  });

  describe('encryptField', () => {
    it('should return a complete EncryptedFieldResult', async () => {
      const result = await service.encryptField('123-45-6789', TEST_CONTEXT);

      expect(result).toEqual({
        ciphertext: expect.any(Buffer),
        blindIndex: expect.stringMatching(/^[0-9a-f]{64}$/),
        lastFour: '6789',
        keyId: TEST_KEY_ARN,
        encryptionVersion: 1,
        encryptedAt: expect.any(Date),
      });
    });

    it('should call envelope.encryptValue with plaintext and context', async () => {
      await service.encryptField('123-45-6789', TEST_CONTEXT);

      expect(mockEnvelope.encryptValue).toHaveBeenCalledWith(
        '123-45-6789',
        TEST_CONTEXT,
      );
    });

    it('should generate blind index using HMAC', async () => {
      const result = await service.encryptField('123-45-6789', TEST_CONTEXT);
      const expectedHash = hmac.hash('123-45-6789');

      expect(result.blindIndex).toBe(expectedHash);
    });

    it('should extract last four correctly for SSN', async () => {
      const result = await service.encryptField('123-45-6789', TEST_CONTEXT);
      expect(result.lastFour).toBe('6789');
    });

    it('should extract last four correctly for EIN', async () => {
      const result = await service.encryptField('12-3456789', TEST_CONTEXT);
      expect(result.lastFour).toBe('6789');
    });

    it('should include the KMS key ARN', async () => {
      const result = await service.encryptField('123-45-6789', TEST_CONTEXT);
      expect(result.keyId).toBe(TEST_KEY_ARN);
    });

    it('should set encryptionVersion to 1', async () => {
      const result = await service.encryptField('123-45-6789', TEST_CONTEXT);
      expect(result.encryptionVersion).toBe(1);
    });

    it('should set encryptedAt to approximately now', async () => {
      const before = new Date();
      const result = await service.encryptField('123-45-6789', TEST_CONTEXT);
      const after = new Date();

      expect(result.encryptedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(result.encryptedAt.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });
  });

  describe('decryptField', () => {
    it('should call envelope.decryptValue with ciphertext and context', async () => {
      const ciphertext = Buffer.from('mock-encrypted-data');

      const result = await service.decryptField(ciphertext, TEST_CONTEXT);

      expect(mockEnvelope.decryptValue).toHaveBeenCalledWith(
        ciphertext,
        TEST_CONTEXT,
      );
      expect(result).toBe('123-45-6789');
    });
  });

  describe('generateBlindIndex', () => {
    it('should return the same hash as encryptField blind index', async () => {
      const encryptResult = await service.encryptField(
        '123-45-6789',
        TEST_CONTEXT,
      );
      const lookupHash = service.generateBlindIndex('123-45-6789');

      expect(lookupHash).toBe(encryptResult.blindIndex);
    });
  });

  describe('generateBlindIndexWithFallback', () => {
    it('should return single hash when no rotation active', () => {
      const hashes = service.generateBlindIndexWithFallback('123-45-6789');
      expect(hashes).toHaveLength(1);
    });

    it('should return two hashes during rotation', () => {
      const hmacWithRotation = new HmacService({
        current: TEST_SECRET,
        previous: 'previous-secret-also-at-least-32-characters-long-here',
      });
      const rotationService = new FieldEncryptionService(
        mockEnvelope,
        hmacWithRotation,
      );

      const hashes =
        rotationService.generateBlindIndexWithFallback('123-45-6789');
      expect(hashes).toHaveLength(2);
    });
  });

  describe('isHmacRotationActive', () => {
    it('should return false by default', () => {
      expect(service.isHmacRotationActive()).toBe(false);
    });
  });
});