import { HmacService } from '../src/services/hmac.service.js';

const TEST_SECRET_A = 'test-secret-alpha-at-least-32-characters-long';
const TEST_SECRET_B = 'test-secret-bravo-at-least-32-characters-long';

describe('HmacService', () => {
  describe('hash', () => {
    it('should produce a 64-character hex string', () => {
      const service = new HmacService({ current: TEST_SECRET_A });
      const result = service.hash('123-45-6789');

      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic — same input produces same output', () => {
      const service = new HmacService({ current: TEST_SECRET_A });

      expect(service.hash('123-45-6789')).toBe(service.hash('123-45-6789'));
    });

    it('should produce different hashes for different inputs', () => {
      const service = new HmacService({ current: TEST_SECRET_A });

      expect(service.hash('123-45-6789')).not.toBe(
        service.hash('987-65-4321'),
      );
    });

    it('should produce different hashes with different secrets', () => {
      const serviceA = new HmacService({ current: TEST_SECRET_A });
      const serviceB = new HmacService({ current: TEST_SECRET_B });

      expect(serviceA.hash('123-45-6789')).not.toBe(
        serviceB.hash('123-45-6789'),
      );
    });

    it('should normalize whitespace — trimmed inputs match', () => {
      const service = new HmacService({ current: TEST_SECRET_A });

      expect(service.hash('  123-45-6789  ')).toBe(
        service.hash('123-45-6789'),
      );
    });

    it('should normalize case — uppercase and lowercase match', () => {
      const service = new HmacService({ current: TEST_SECRET_A });

      expect(service.hash('ABC123')).toBe(service.hash('abc123'));
    });

    it('should NOT normalize formatting — dashes matter', () => {
      const service = new HmacService({ current : TEST_SECRET_A });

      // These should hash differently to prevent cross-format collisions
      expect(service.hash('123-45-6789')).not.toBe(
        service.hash('123456789'),
      );
    });
  });

  describe('hashWithFallback', () => {
    it('should return single-element array when no previous secret', () => {
      const service = new HmacService({ current: TEST_SECRET_A });
      const result = service.hashWithFallback('123-45-6789');

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(service.hash('123-45-6789'));
    });

    it('should return two-element array during rotation', () => {
      const service = new HmacService({
        current: TEST_SECRET_A,
        previous: TEST_SECRET_B,
      });

      const result = service.hashWithFallback('123-45-6789');

      expect(result).toHaveLength(2);
      // First element is always current
      expect(result[0]).toBe(service.hash('123-45-6789'));
      // Second element is the previous hash
      const previousService = new HmacService({ current: TEST_SECRET_B });
      expect(result[1]).toBe(previousService.hash('123-45-6789'));
    });

    it('should include current hash that matches blind index for writes', () => {
      const service = new HmacService({
        current: TEST_SECRET_A,
        previous: TEST_SECRET_B,
      });

      const writeHash = service.hash('123-45-6789');
      const lookupHashes = service.hashWithFallback('123-45-6789');

      expect(lookupHashes).toContain(writeHash);
      expect(lookupHashes[0]).toBe(writeHash); // current is always first
    });
  });

  describe('isRotationActive', () => {
    it('should return false when no previous secret', () => {
      const service = new HmacService({ current: TEST_SECRET_A });
      expect(service.isRotationActive()).toBe(false);
    });

    it('should return true when previous secret is set', () => {
      const service = new HmacService({
        current: TEST_SECRET_A,
        previous: TEST_SECRET_B,
      });
      expect(service.isRotationActive()).toBe(true);
    });
  });
});