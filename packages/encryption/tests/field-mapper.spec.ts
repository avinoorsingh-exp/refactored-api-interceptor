import { mapEncryptedFieldToColumns } from '../src/utils/field-mapper.js';
import type { EncryptedFieldResult } from '../src/types/encrypted-field.types.js';

describe('mapEncryptedFieldToColumns', () => {
  const mockResult: EncryptedFieldResult = {
    ciphertext: Buffer.from('encrypted-data'),
    blindIndex: 'a'.repeat(64),
    lastFour: '6789',
    keyId: 'arn:aws:kms:us-east-1:123456789012:key/test-key',
    encryptionVersion: 1,
    encryptedAt: new Date('2025-01-15T12:00:00Z'),
  };

  it('should map with tax_id prefix', () => {
    const columns = mapEncryptedFieldToColumns(mockResult, 'tax_id');

    expect(columns).toEqual({
      tax_id: mockResult.ciphertext,
      tax_id_hashed: mockResult.blindIndex,
      tax_id_last4: mockResult.lastFour,
      encryption_key_id: mockResult.keyId,
      encryption_version: 1,
      encrypted_at: mockResult.encryptedAt,
    });
  });

  it('should map with account_number prefix', () => {
    const columns = mapEncryptedFieldToColumns(mockResult, 'account_number');

    expect(columns.account_number).toBe(mockResult.ciphertext);
    expect(columns.account_number_hashed).toBe(mockResult.blindIndex);
    expect(columns.account_number_last4).toBe(mockResult.lastFour);
  });

  it('should map with type_value prefix', () => {
    const columns = mapEncryptedFieldToColumns(mockResult, 'type_value');

    expect(columns.type_value).toBe(mockResult.ciphertext);
    expect(columns.type_value_hashed).toBe(mockResult.blindIndex);
    expect(columns.type_value_last4).toBe(mockResult.lastFour);
  });

  it('should always include encryption_key_id, encryption_version, and encrypted_at regardless of prefix', () => {
    const columns = mapEncryptedFieldToColumns(mockResult, 'routing_number');

    expect(columns.encryption_key_id).toBe(mockResult.keyId);
    expect(columns.encryption_version).toBe(1);
    expect(columns.encrypted_at).toBe(mockResult.encryptedAt);
  });
});