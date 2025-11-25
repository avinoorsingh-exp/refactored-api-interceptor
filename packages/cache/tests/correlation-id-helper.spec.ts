import { describe, it, expect } from '@jest/globals'
import * as fc from 'fast-check'
import { CorrelationIdHelper } from '../src/async-context.storage.js'
import {
	UUID_V4_REGEX,
	isValidUuidV4,
	generateValidCorrelationId,
	generateEmptyCorrelationId,
	generateLongCorrelationId,
	generateCorrelationIdWithNewline,
	generateCorrelationIdWithCarriageReturn,
	generateMaxLengthCorrelationId,
	areAllUnique,
} from './utils/correlation-id-test-utils.js'

describe('CorrelationIdHelper', () => {
	describe('generateCorrelationId()', () => {
		it('should return a valid UUID v4 format', () => {
			const id = CorrelationIdHelper.generateCorrelationId()
			expect(id).toMatch(UUID_V4_REGEX)
			expect(isValidUuidV4(id)).toBe(true)
		})

		it('should generate unique IDs across 1000 generations', () => {
			const ids: string[] = []
			for (let i = 0; i < 1000; i++) {
				ids.push(CorrelationIdHelper.generateCorrelationId())
			}

			// Verify all IDs are unique
			expect(areAllUnique(ids)).toBe(true)
			expect(new Set(ids).size).toBe(1000)
		})

		it('should generate unique IDs in concurrent generation', async () => {
			// Generate 100 IDs concurrently
			const promises = Array.from({ length: 100 }, () =>
				Promise.resolve(CorrelationIdHelper.generateCorrelationId()),
			)

			const ids = await Promise.all(promises)

			// Verify all IDs are unique
			expect(areAllUnique(ids)).toBe(true)
			expect(new Set(ids).size).toBe(100)

			// Verify all are valid UUID v4
			ids.forEach((id) => {
				expect(isValidUuidV4(id)).toBe(true)
			})
		})

		it('should generate IDs that are strings', () => {
			const id = CorrelationIdHelper.generateCorrelationId()
			expect(typeof id).toBe('string')
		})

		it('should generate IDs with expected length (36 characters for UUID v4)', () => {
			const id = CorrelationIdHelper.generateCorrelationId()
			expect(id.length).toBe(36) // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
		})
	})

	describe('isValidCorrelationId()', () => {
		describe('valid inputs', () => {
			it('should accept valid UUID v4', () => {
				const validUuid = generateValidCorrelationId()
				expect(CorrelationIdHelper.isValidCorrelationId(validUuid)).toBe(true)
			})

			it('should accept short strings', () => {
				expect(CorrelationIdHelper.isValidCorrelationId('a')).toBe(true)
				expect(CorrelationIdHelper.isValidCorrelationId('abc')).toBe(true)
				expect(CorrelationIdHelper.isValidCorrelationId('test-123')).toBe(true)
			})

			it('should accept 100-character strings', () => {
				const maxLengthId = generateMaxLengthCorrelationId()
				expect(maxLengthId.length).toBe(100)
				expect(CorrelationIdHelper.isValidCorrelationId(maxLengthId)).toBe(true)
			})

			it('should accept strings with various valid characters', () => {
				expect(CorrelationIdHelper.isValidCorrelationId('abc-123-def')).toBe(true)
				expect(CorrelationIdHelper.isValidCorrelationId('test_id_456')).toBe(true)
				expect(CorrelationIdHelper.isValidCorrelationId('ID.WITH.DOTS')).toBe(true)
			})
		})

		describe('invalid inputs', () => {
			it('should reject empty string', () => {
				const emptyId = generateEmptyCorrelationId()
				expect(CorrelationIdHelper.isValidCorrelationId(emptyId)).toBe(false)
			})

			it('should reject 101-character string', () => {
				const longId = generateLongCorrelationId(101)
				expect(longId.length).toBe(101)
				expect(CorrelationIdHelper.isValidCorrelationId(longId)).toBe(false)
			})

			it('should reject string with newline (\\n)', () => {
				const idWithNewline = generateCorrelationIdWithNewline()
				expect(idWithNewline).toContain('\n')
				expect(CorrelationIdHelper.isValidCorrelationId(idWithNewline)).toBe(false)
			})

			it('should reject string with carriage return (\\r)', () => {
				const idWithCR = generateCorrelationIdWithCarriageReturn()
				expect(idWithCR).toContain('\r')
				expect(CorrelationIdHelper.isValidCorrelationId(idWithCR)).toBe(false)
			})

			it('should reject string with both \\r and \\n', () => {
				const idWithBoth = 'test\r\nid'
				expect(CorrelationIdHelper.isValidCorrelationId(idWithBoth)).toBe(false)
			})
		})

		describe('edge cases', () => {
			it('should reject null (type coercion)', () => {
				// @ts-expect-error Testing runtime behavior with invalid type
				expect(CorrelationIdHelper.isValidCorrelationId(null)).toBe(false)
			})

			it('should reject undefined (type coercion)', () => {
				// @ts-expect-error Testing runtime behavior with invalid type
				expect(CorrelationIdHelper.isValidCorrelationId(undefined)).toBe(false)
			})

			it('should reject number (type coercion)', () => {
				// @ts-expect-error Testing runtime behavior with invalid type
				expect(CorrelationIdHelper.isValidCorrelationId(123)).toBe(false)
			})

			it('should reject object (type coercion)', () => {
				// @ts-expect-error Testing runtime behavior with invalid type
				expect(CorrelationIdHelper.isValidCorrelationId({})).toBe(false)
			})

			it('should reject array (type coercion)', () => {
				// @ts-expect-error Testing runtime behavior with invalid type
				expect(CorrelationIdHelper.isValidCorrelationId([])).toBe(false)
			})
		})
	})

	describe('extractCorrelationId()', () => {
		describe('valid correlation ID', () => {
			it('should return the same ID when valid', () => {
				const validId = 'valid-correlation-id-123'
				const result = CorrelationIdHelper.extractCorrelationId(validId)
				expect(result).toBe(validId)
			})

			it('should return the same UUID v4 when provided', () => {
				const validUuid = generateValidCorrelationId()
				const result = CorrelationIdHelper.extractCorrelationId(validUuid)
				expect(result).toBe(validUuid)
			})

			it('should return the same max-length ID when valid', () => {
				const maxLengthId = generateMaxLengthCorrelationId()
				const result = CorrelationIdHelper.extractCorrelationId(maxLengthId)
				expect(result).toBe(maxLengthId)
			})
		})

		describe('invalid correlation ID', () => {
			it('should generate new UUID v4 when ID is invalid', () => {
				const invalidId = generateLongCorrelationId(101)
				const result = CorrelationIdHelper.extractCorrelationId(invalidId)

				expect(result).not.toBe(invalidId)
				expect(isValidUuidV4(result)).toBe(true)
			})

			it('should generate new UUID v4 when ID contains newline', () => {
				const idWithNewline = generateCorrelationIdWithNewline()
				const result = CorrelationIdHelper.extractCorrelationId(idWithNewline)

				expect(result).not.toBe(idWithNewline)
				expect(result).not.toContain('\n')
				expect(isValidUuidV4(result)).toBe(true)
			})

			it('should generate new UUID v4 when ID contains carriage return', () => {
				const idWithCR = generateCorrelationIdWithCarriageReturn()
				const result = CorrelationIdHelper.extractCorrelationId(idWithCR)

				expect(result).not.toBe(idWithCR)
				expect(result).not.toContain('\r')
				expect(isValidUuidV4(result)).toBe(true)
			})
		})

		describe('undefined input', () => {
			it('should generate new UUID v4 when undefined', () => {
				const result = CorrelationIdHelper.extractCorrelationId(undefined)

				expect(result).toBeDefined()
				expect(isValidUuidV4(result)).toBe(true)
			})

			it('should generate different IDs on multiple calls with undefined', () => {
				const id1 = CorrelationIdHelper.extractCorrelationId(undefined)
				const id2 = CorrelationIdHelper.extractCorrelationId(undefined)

				expect(id1).not.toBe(id2)
				expect(isValidUuidV4(id1)).toBe(true)
				expect(isValidUuidV4(id2)).toBe(true)
			})
		})

		describe('empty string', () => {
			it('should generate new UUID v4 when empty string', () => {
				const emptyId = generateEmptyCorrelationId()
				const result = CorrelationIdHelper.extractCorrelationId(emptyId)

				expect(result).not.toBe(emptyId)
				expect(result.length).toBeGreaterThan(0)
				expect(isValidUuidV4(result)).toBe(true)
			})
		})
	})

	describe('Property-Based Tests', () => {
		describe('Property 2: UUID v4 Generation for Missing Headers', () => {
			/**
			 * Feature: x-correlation-id, Property 2: UUID v4 Generation for Missing Headers
			 * Validates: Requirements 1.2, 2.4
			 */
			it('should always generate valid UUID v4 format', () => {
				fc.assert(
					fc.property(fc.constant(undefined), () => {
						const id = CorrelationIdHelper.generateCorrelationId()

						// Verify UUID v4 format
						expect(isValidUuidV4(id)).toBe(true)
						expect(id).toMatch(UUID_V4_REGEX)
					}),
					{ numRuns: 100 },
				)
			})

			it('should always generate unique IDs', () => {
				const generatedIds = new Set<string>()

				fc.assert(
					fc.property(fc.constant(undefined), () => {
						const id = CorrelationIdHelper.generateCorrelationId()

						// Verify uniqueness
						expect(generatedIds.has(id)).toBe(false)
						generatedIds.add(id)

						// Verify valid format
						expect(isValidUuidV4(id)).toBe(true)
					}),
					{ numRuns: 100 },
				)
			})

			it('should generate valid UUID v4 when extracting from undefined', () => {
				fc.assert(
					fc.property(fc.constant(undefined), () => {
						const id = CorrelationIdHelper.extractCorrelationId(undefined)

						// Verify UUID v4 format
						expect(isValidUuidV4(id)).toBe(true)
						expect(id).toMatch(UUID_V4_REGEX)
					}),
					{ numRuns: 100 },
				)
			})
		})

		describe('Property 3: Invalid Correlation ID Rejection', () => {
			/**
			 * Feature: x-correlation-id, Property 3: Invalid Correlation ID Rejection
			 * Validates: Requirements 1.3, 6.1, 6.2, 6.3
			 */
			it('should reject empty strings and generate valid UUID v4', () => {
				fc.assert(
					fc.property(fc.constant(''), (emptyString) => {
						const result = CorrelationIdHelper.extractCorrelationId(emptyString)

						// Verify returned ID is valid UUID v4
						expect(isValidUuidV4(result)).toBe(true)
						expect(result).toMatch(UUID_V4_REGEX)

						// Verify returned ID differs from input
						expect(result).not.toBe(emptyString)
					}),
					{ numRuns: 100 },
				)
			})

			it('should reject long strings (>100 chars) and generate valid UUID v4', () => {
				fc.assert(
					fc.property(
						fc.string({ minLength: 101, maxLength: 200 }),
						(longString) => {
							const result = CorrelationIdHelper.extractCorrelationId(longString)

							// Verify returned ID is valid UUID v4
							expect(isValidUuidV4(result)).toBe(true)
							expect(result).toMatch(UUID_V4_REGEX)

							// Verify returned ID differs from input
							expect(result).not.toBe(longString)

							// Verify returned ID is within valid length
							expect(result.length).toBeLessThanOrEqual(100)
						},
					),
					{ numRuns: 100 },
				)
			})

			it('should reject strings with newlines and generate valid UUID v4', () => {
				fc.assert(
					fc.property(
						fc
							.string({ minLength: 1, maxLength: 50 })
							.map((s) => s + '\n' + 'injection'),
						(stringWithNewline) => {
							// Verify input contains newline
							expect(stringWithNewline).toContain('\n')

							const result =
								CorrelationIdHelper.extractCorrelationId(stringWithNewline)

							// Verify returned ID is valid UUID v4
							expect(isValidUuidV4(result)).toBe(true)
							expect(result).toMatch(UUID_V4_REGEX)

							// Verify returned ID differs from input
							expect(result).not.toBe(stringWithNewline)

							// Verify returned ID does not contain newline
							expect(result).not.toContain('\n')
						},
					),
					{ numRuns: 100 },
				)
			})

			it('should reject strings with carriage returns and generate valid UUID v4', () => {
				fc.assert(
					fc.property(
						fc
							.string({ minLength: 1, maxLength: 50 })
							.map((s) => s + '\r' + 'injection'),
						(stringWithCR) => {
							// Verify input contains carriage return
							expect(stringWithCR).toContain('\r')

							const result = CorrelationIdHelper.extractCorrelationId(stringWithCR)

							// Verify returned ID is valid UUID v4
							expect(isValidUuidV4(result)).toBe(true)
							expect(result).toMatch(UUID_V4_REGEX)

							// Verify returned ID differs from input
							expect(result).not.toBe(stringWithCR)

							// Verify returned ID does not contain carriage return
							expect(result).not.toContain('\r')
						},
					),
					{ numRuns: 100 },
				)
			})

			it('should handle various invalid inputs consistently', () => {
				fc.assert(
					fc.property(
						fc.oneof(
							fc.constant(''), // empty
							fc.string({ minLength: 101, maxLength: 200 }), // too long
							fc.string().map((s) => s + '\n'), // with newline
							fc.string().map((s) => s + '\r'), // with carriage return
							fc.string().map((s) => s + '\r\n'), // with both
						),
						(invalidInput) => {
							const result = CorrelationIdHelper.extractCorrelationId(invalidInput)

							// All invalid inputs should result in valid UUID v4
							expect(isValidUuidV4(result)).toBe(true)
							expect(result).toMatch(UUID_V4_REGEX)

							// Result should differ from invalid input
							expect(result).not.toBe(invalidInput)

							// Result should be valid according to validation function
							expect(CorrelationIdHelper.isValidCorrelationId(result)).toBe(true)
						},
					),
					{ numRuns: 100 },
				)
			})
		})
	})
})
