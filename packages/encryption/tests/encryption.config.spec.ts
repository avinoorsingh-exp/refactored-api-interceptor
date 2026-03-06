import { EncryptionConfigSchema } from '../src/config/encryption.config.js';

describe('EncryptionConfigSchema', () => {
  const validConfig = {
    kms: {
      keyArn: 'arn:aws:kms:us-east-1:123456789012:alias/test',
      region: 'us-east-1',
    },
    hmac: {
      current: 'a-secret-that-is-at-least-32-characters-long',
    },
  };

  it('accepts a valid config', () => {
    const result = EncryptionConfigSchema.parse(validConfig);
    expect(result.kms.keyArn).toBe(validConfig.kms.keyArn);
  });

  it('defaults region to us-east-1', () => {
    const { region, ...kmsWithoutRegion } = validConfig.kms;
    const result = EncryptionConfigSchema.parse({
      ...validConfig,
      kms: kmsWithoutRegion,
    });
    expect(result.kms.region).toBe('us-east-1');
  });

  it('accepts optional previous HMAC secret', () => {
    const config = {
      ...validConfig,
      hmac: {
        current: validConfig.hmac.current,
        previous: 'another-secret-that-is-at-least-32-chars-long',
      },
    };
    const result = EncryptionConfigSchema.parse(config);
    expect(result.hmac.previous).toBeDefined();
  });

  it('rejects empty KMS key ARN', () => {
    expect(() =>
      EncryptionConfigSchema.parse({
        ...validConfig,
        kms: { ...validConfig.kms, keyArn: '' },
      }),
    ).toThrow();
  });

  it('rejects HMAC secret shorter than 32 characters', () => {
    expect(() =>
      EncryptionConfigSchema.parse({
        ...validConfig,
        hmac: { current: 'too-short' },
      }),
    ).toThrow('at least 32 characters');
  });

  it('rejects previous HMAC secret shorter than 32 characters', () => {
    expect(() =>
      EncryptionConfigSchema.parse({
        ...validConfig,
        hmac: {
          current: validConfig.hmac.current,
          previous: 'short',
        },
      }),
    ).toThrow('at least 32 characters');
  });

  it('accepts optional cache TTL', () => {
    const result = EncryptionConfigSchema.parse({
      ...validConfig,
      kms: { ...validConfig.kms, cacheTtlSeconds: 300 },
    });
    expect(result.kms.cacheTtlSeconds).toBe(300);
  });

  it('rejects negative cache TTL', () => {
    expect(() =>
      EncryptionConfigSchema.parse({
        ...validConfig,
        kms: { ...validConfig.kms, cacheTtlSeconds: -1 },
      }),
    ).toThrow();
  });
});