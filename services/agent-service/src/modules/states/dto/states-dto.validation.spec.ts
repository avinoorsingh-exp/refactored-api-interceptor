import { z } from 'zod';
import {
  CreateStateInputSchema,
  UpdateStateInputSchema,
  StateIdParamSchema,
} from '@exprealty/shared-domain';

/**
 * States DTO Validation Tests
 * Tests validation constraints for State DTOs
 * Validates: Requirements 15.1, 15.2 (DTO Validation Coverage)
 * 
 * POST AC3: Validation - malformed or violates constraints returns 400 Bad Request
 * PUT AC3: Validation - malformed or violates constraints returns 400 Bad Request
 */
describe('States DTO Validation', () => {
  describe('CreateStateInputSchema', () => {
    const validInput = {
      name: 'California',
      code: 'CA',
      isActive: true,
      regionId: '1',
      countryId: 1,
      email: 'california@example.com',
    };

    describe('name field', () => {
      /**
       * AC3: Validation - missing name should fail
       */
      it('should reject missing name', () => {
        const { name, ...inputWithoutName } = validInput;
        const result = CreateStateInputSchema.safeParse(inputWithoutName);
        expect(result.success).toBe(false);
      });

      /**
       * AC3: Validation - empty name should fail
       */
      it('should reject empty name', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, name: '' });
        expect(result.success).toBe(false);
      });

      /**
       * AC3: Validation - name exceeding max length should fail
       */
      it('should reject name exceeding 255 characters', () => {
        const longName = 'a'.repeat(256);
        const result = CreateStateInputSchema.safeParse({ ...validInput, name: longName });
        expect(result.success).toBe(false);
      });

      it('should accept valid name', () => {
        const result = CreateStateInputSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept name at max length (255 chars)', () => {
        const maxName = 'a'.repeat(255);
        const result = CreateStateInputSchema.safeParse({ ...validInput, name: maxName });
        expect(result.success).toBe(true);
      });
    });

    describe('code field', () => {
      /**
       * AC3: Validation - missing code should fail
       */
      it('should reject missing code', () => {
        const { code, ...inputWithoutCode } = validInput;
        const result = CreateStateInputSchema.safeParse(inputWithoutCode);
        expect(result.success).toBe(false);
      });

      /**
       * AC3: Validation - code not exactly 2 characters should fail
       */
      it('should reject code with less than 2 characters', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, code: 'C' });
        expect(result.success).toBe(false);
      });

      it('should reject code with more than 2 characters', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, code: 'CAL' });
        expect(result.success).toBe(false);
      });

      it('should accept valid 2-character code', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, code: 'TX' });
        expect(result.success).toBe(true);
      });
    });

    describe('isActive field', () => {
      it('should reject missing isActive', () => {
        const { isActive, ...inputWithoutIsActive } = validInput;
        const result = CreateStateInputSchema.safeParse(inputWithoutIsActive);
        expect(result.success).toBe(false);
      });

      it('should reject non-boolean isActive', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, isActive: 'true' });
        expect(result.success).toBe(false);
      });

      it('should accept boolean true', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, isActive: true });
        expect(result.success).toBe(true);
      });

      it('should accept boolean false', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, isActive: false });
        expect(result.success).toBe(true);
      });
    });

    describe('regionId field', () => {
      it('should reject missing regionId', () => {
        const { regionId, ...inputWithoutRegionId } = validInput;
        const result = CreateStateInputSchema.safeParse(inputWithoutRegionId);
        expect(result.success).toBe(false);
      });

      it('should reject non-numeric string regionId', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, regionId: 'abc' });
        expect(result.success).toBe(false);
      });

      it('should accept numeric string regionId', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, regionId: '123' });
        expect(result.success).toBe(true);
      });
    });

    describe('countryId field', () => {
      it('should reject missing countryId', () => {
        const { countryId, ...inputWithoutCountryId } = validInput;
        const result = CreateStateInputSchema.safeParse(inputWithoutCountryId);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer countryId', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, countryId: 1.5 });
        expect(result.success).toBe(false);
      });

      it('should accept integer countryId', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, countryId: 1 });
        expect(result.success).toBe(true);
      });
    });

    describe('email field (optional)', () => {
      it('should accept missing email', () => {
        const { email, ...inputWithoutEmail } = validInput;
        const result = CreateStateInputSchema.safeParse(inputWithoutEmail);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email format', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, email: 'not-an-email' });
        expect(result.success).toBe(false);
      });

      it('should accept valid email', () => {
        const result = CreateStateInputSchema.safeParse({ ...validInput, email: 'test@example.com' });
        expect(result.success).toBe(true);
      });
    });

    describe('signatureDistributionEmail field (optional)', () => {
      it('should accept missing signatureDistributionEmail', () => {
        const result = CreateStateInputSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should reject invalid signatureDistributionEmail format', () => {
        const result = CreateStateInputSchema.safeParse({
          ...validInput,
          signatureDistributionEmail: 'invalid-email',
        });
        expect(result.success).toBe(false);
      });

      it('should accept valid signatureDistributionEmail', () => {
        const result = CreateStateInputSchema.safeParse({
          ...validInput,
          signatureDistributionEmail: 'sig@example.com',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('UpdateStateInputSchema', () => {
    /**
     * PUT AC3: Validation - partial updates should be allowed
     */
    describe('partial update support', () => {
      it('should accept empty object (no fields to update)', () => {
        const result = UpdateStateInputSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should accept partial update with only name', () => {
        const result = UpdateStateInputSchema.safeParse({ name: 'Updated Name' });
        expect(result.success).toBe(true);
      });

      it('should accept partial update with only code', () => {
        const result = UpdateStateInputSchema.safeParse({ code: 'TX' });
        expect(result.success).toBe(true);
      });

      it('should accept partial update with only isActive', () => {
        const result = UpdateStateInputSchema.safeParse({ isActive: false });
        expect(result.success).toBe(true);
      });

      it('should accept partial update with multiple fields', () => {
        const result = UpdateStateInputSchema.safeParse({
          name: 'Updated Name',
          isActive: false,
          email: 'new@example.com',
        });
        expect(result.success).toBe(true);
      });
    });

    /**
     * PUT AC3: Validation - invalid values should still fail
     */
    describe('validation still applies to provided fields', () => {
      it('should reject empty name when provided', () => {
        const result = UpdateStateInputSchema.safeParse({ name: '' });
        expect(result.success).toBe(false);
      });

      it('should reject invalid code length when provided', () => {
        const result = UpdateStateInputSchema.safeParse({ code: 'ABC' });
        expect(result.success).toBe(false);
      });

      it('should reject invalid email when provided', () => {
        const result = UpdateStateInputSchema.safeParse({ email: 'not-valid' });
        expect(result.success).toBe(false);
      });

      it('should reject non-boolean isActive when provided', () => {
        const result = UpdateStateInputSchema.safeParse({ isActive: 'yes' });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('StateIdParamSchema', () => {
    /**
     * GET AC3: Validation - invalid UUID format returns 400
     */
    describe('UUID validation', () => {
      it('should accept valid UUID', () => {
        const result = StateIdParamSchema.safeParse({
          id: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid UUID format', () => {
        const result = StateIdParamSchema.safeParse({ id: 'not-a-uuid' });
        expect(result.success).toBe(false);
      });

      it('should reject missing id', () => {
        const result = StateIdParamSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('should reject empty string id', () => {
        const result = StateIdParamSchema.safeParse({ id: '' });
        expect(result.success).toBe(false);
      });

      it('should reject incomplete UUID', () => {
        const result = StateIdParamSchema.safeParse({ id: '550e8400-e29b-41d4' });
        expect(result.success).toBe(false);
      });

      it('should reject UUID without dashes', () => {
        const result = StateIdParamSchema.safeParse({
          id: '550e8400e29b41d4a716446655440000',
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
