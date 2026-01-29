// services/orchestrator/src/common/zod-validation.pipe.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe.js';
import { z } from 'zod';

describe('ZodValidationPipe', () => {
  const stringSchema = z.string().min(3);
  const objectSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
    email: z.string().email(),
  });

  describe('transform - valid input', () => {
    it('should return validated string', () => {
      const pipe = new ZodValidationPipe(stringSchema);
      const result = pipe.transform('valid string');

      expect(result).toBe('valid string');
    });

    it('should return validated object', () => {
      const pipe = new ZodValidationPipe(objectSchema);
      const input = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      };

      const result = pipe.transform(input);

      expect(result).toEqual(input);
    });

    it('should transform and validate nested objects', () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({
            street: z.string(),
            city: z.string(),
          }),
        }),
      });

      const pipe = new ZodValidationPipe(nestedSchema);
      const input = {
        user: {
          name: 'John',
          address: {
            street: '123 Main St',
            city: 'New York',
          },
        },
      };

      const result = pipe.transform(input);

      expect(result).toEqual(input);
    });

    it('should handle optional fields', () => {
      const schemaWithOptional = z.object({
        name: z.string(),
        description: z.string().optional(),
      });

      const pipe = new ZodValidationPipe(schemaWithOptional);
      const input = { name: 'Test' };

      const result = pipe.transform(input);

      expect(result).toEqual({ name: 'Test', description: undefined });
    });

    it('should handle arrays', () => {
      const arraySchema = z.array(z.string().min(1));

      const pipe = new ZodValidationPipe(arraySchema);
      const input = ['item1', 'item2', 'item3'];

      const result = pipe.transform(input);

      expect(result).toEqual(input);
    });
  });

  describe('transform - invalid input', () => {
    it('should throw BadRequestException for invalid string', () => {
      const pipe = new ZodValidationPipe(stringSchema);

      expect(() => {
        pipe.transform('ab'); // Too short
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException with _zodIssues for invalid object', () => {
      const pipe = new ZodValidationPipe(objectSchema);

      try {
        pipe.transform({
          name: '', // Invalid: too short
          age: -5, // Invalid: negative
          email: 'not-an-email', // Invalid: not an email
        });
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as { _zodIssues: unknown[] };
        expect(response).toHaveProperty('_zodIssues');
        expect(Array.isArray(response._zodIssues)).toBe(true);
        expect(response._zodIssues.length).toBeGreaterThan(0);
      }
    });

    it('should include all validation errors in _zodIssues', () => {
      const pipe = new ZodValidationPipe(objectSchema);

      try {
        pipe.transform({
          name: '',
          age: 'not-a-number',
          email: 'invalid',
        });
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as { _zodIssues: unknown[] };
        const issues = response._zodIssues;

        expect(issues.length).toBeGreaterThanOrEqual(3);
        expect(issues.some((issue: any) => issue.path.includes('name'))).toBe(true);
        expect(issues.some((issue: any) => issue.path.includes('age'))).toBe(true);
        expect(issues.some((issue: any) => issue.path.includes('email'))).toBe(true);
      }
    });

    it('should throw BadRequestException for wrong type', () => {
      const pipe = new ZodValidationPipe(stringSchema);

      expect(() => {
        pipe.transform(123); // Number instead of string
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for null', () => {
      const pipe = new ZodValidationPipe(stringSchema);

      expect(() => {
        pipe.transform(null);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for undefined', () => {
      const pipe = new ZodValidationPipe(stringSchema);

      expect(() => {
        pipe.transform(undefined);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing required fields', () => {
      const pipe = new ZodValidationPipe(objectSchema);

      try {
        pipe.transform({
          name: 'John',
          // Missing age and email
        });
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as { _zodIssues: unknown[] };
        expect(response._zodIssues.some((issue: any) => issue.path.includes('age'))).toBe(true);
        expect(response._zodIssues.some((issue: any) => issue.path.includes('email'))).toBe(true);
      }
    });

    it('should handle nested validation errors', () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string().min(1),
        }),
      });

      const pipe = new ZodValidationPipe(nestedSchema);

      try {
        pipe.transform({
          user: {
            name: '', // Invalid
          },
        });
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as { _zodIssues: unknown[] };
        const issues = response._zodIssues;
        expect(issues.some((issue: any) => issue.path.includes('user') && issue.path.includes('name'))).toBe(true);
      }
    });
  });

  describe('transform - edge cases', () => {
    it('should handle empty string with min length requirement', () => {
      const pipe = new ZodValidationPipe(stringSchema);

      expect(() => {
        pipe.transform('');
      }).toThrow(BadRequestException);
    });

    it('should handle empty object', () => {
      const pipe = new ZodValidationPipe(objectSchema);

      expect(() => {
        pipe.transform({});
      }).toThrow(BadRequestException);
    });

    it('should handle empty array when array is required', () => {
      const arraySchema = z.array(z.string()).min(1);

      const pipe = new ZodValidationPipe(arraySchema);

      expect(() => {
        pipe.transform([]);
      }).toThrow(BadRequestException);
    });

    it('should use custom error map from validationErrorMap', () => {
      const pipe = new ZodValidationPipe(stringSchema);

      try {
        pipe.transform('ab');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as { _zodIssues: Array<{ message?: string; code?: string }> };
        expect(response._zodIssues).toBeDefined();
        // The error map should provide formatted messages
        expect(response._zodIssues[0]).toHaveProperty('message');
        expect(response._zodIssues[0]).toHaveProperty('code');
      }
    });
  });
});