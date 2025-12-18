/**
 * Property-Based Tests for DTO Validation
 *
 * These tests verify that DTO validation schemas enforce required fields,
 * format constraints (email, UUID), and length limits.
 *
 * **Feature: agent-service-coverage, Property 25: DTO Validation Constraints**
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**
 */

import * as fc from 'fast-check'
import {
	CreateStateInputSchema,
	UpdateStateInputSchema,
	CreateCompanyInputSchema,
	CreatePayPlanInputSchema,
	PaginationQuerySchema,
	NormalizedPaginationSchema,
	LIMIT_MAX,
} from '@exprealty/shared-domain'

describe('DTO Validation Property Tests', () => {
	/**
	 * **Feature: agent-service-coverage, Property 25: DTO Validation Constraints**
	 * **Validates: Requirements 15.1**
	 *
	 * *For any* CreateStateDto input, the Zod schema SHALL enforce required fields
	 * and format constraints.
	 */
	describe('CreateStateDto Validation (Requirement 15.1)', () => {
		// Valid state code generator (2 uppercase letters)
		const stateCodeArbitrary = fc
			.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
				minLength: 2,
				maxLength: 2,
			})
			.map((chars) => chars.join(''))

		// Valid email generator
		const validEmailArbitrary = fc
			.tuple(
				fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
				fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
				fc.constantFrom('com', 'org', 'net'),
			)
			.map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

		it('should accept any valid CreateState input', () => {
			const validInputArbitrary = fc.record({
				name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
				code: stateCodeArbitrary,
				isActive: fc.boolean(),
				regionId: fc.integer({ min: 1, max: 10000 }).map(String),
				countryId: fc.integer({ min: 1, max: 300 }),
				email: fc.option(validEmailArbitrary, { nil: undefined }),
				signatureDistributionEmail: fc.option(validEmailArbitrary, { nil: undefined }),
			})

			fc.assert(
				fc.property(validInputArbitrary, (input) => {
					const result = CreateStateInputSchema.safeParse(input)
					expect(result.success).toBe(true)
				}),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with missing required name field', () => {
			fc.assert(
				fc.property(
					fc.record({
						code: stateCodeArbitrary,
						isActive: fc.boolean(),
						regionId: fc.integer({ min: 1, max: 10000 }).map(String),
						countryId: fc.integer({ min: 1, max: 300 }),
					}),
					(input) => {
						const result = CreateStateInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with invalid state code length', () => {
			// Generate codes that are not exactly 2 characters (after trimming)
			// Filter out strings with trailing/leading whitespace since schema trims
			const invalidCodeArbitrary = fc.oneof(
				fc.string({ minLength: 0, maxLength: 1 }).filter((s) => s.trim().length !== 2),
				fc.string({ minLength: 3, maxLength: 10 }).filter((s) => s.trim().length !== 2),
			)

			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
						code: invalidCodeArbitrary,
						isActive: fc.boolean(),
						regionId: fc.integer({ min: 1, max: 10000 }).map(String),
						countryId: fc.integer({ min: 1, max: 300 }),
					}),
					(input) => {
						const result = CreateStateInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with invalid regionId format', () => {
			// regionId must be a string of digits
			const invalidRegionIdArbitrary = fc.oneof(
				fc.constant('abc'),
				fc.constant('-1'),
				fc.constant('1.5'),
				fc.stringMatching(/^[a-z]+$/),
			)

			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
						code: stateCodeArbitrary,
						isActive: fc.boolean(),
						regionId: invalidRegionIdArbitrary,
						countryId: fc.integer({ min: 1, max: 300 }),
					}),
					(input) => {
						const result = CreateStateInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * **Feature: agent-service-coverage, Property 25: DTO Validation Constraints**
	 * **Validates: Requirements 15.2**
	 *
	 * *For any* UpdateStateDto input, the Zod schema SHALL support partial updates.
	 */
	describe('UpdateStateDto Validation (Requirement 15.2)', () => {
		const stateCodeArbitrary = fc
			.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
				minLength: 2,
				maxLength: 2,
			})
			.map((chars) => chars.join(''))

		it('should accept any partial update with valid fields', () => {
			// UpdateStateInputSchema is partial, so any subset of valid fields should work
			fc.assert(
				fc.property(
					fc.record({
						name: fc.option(
							fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
							{ nil: undefined },
						),
						code: fc.option(stateCodeArbitrary, { nil: undefined }),
						isActive: fc.option(fc.boolean(), { nil: undefined }),
					}),
					(input) => {
						// Filter out undefined values to create a clean partial object
						const cleanInput = Object.fromEntries(
							Object.entries(input).filter(([_, v]) => v !== undefined),
						)
						const result = UpdateStateInputSchema.safeParse(cleanInput)
						expect(result.success).toBe(true)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should accept empty object for partial update', () => {
			const result = UpdateStateInputSchema.safeParse({})
			expect(result.success).toBe(true)
		})
	})

	/**
	 * **Feature: agent-service-coverage, Property 25: DTO Validation Constraints**
	 * **Validates: Requirements 15.3**
	 *
	 * *For any* CreateCompanyDto input, the Zod schema SHALL verify name and email validation.
	 */
	describe('CreateCompanyDto Validation (Requirement 15.3)', () => {
		const validEmailArbitrary = fc
			.tuple(
				fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
				fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
				fc.constantFrom('com', 'org', 'net'),
			)
			.map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

		it('should accept any valid CreateCompany input', () => {
			const validInputArbitrary = fc.record({
				name: fc.string({ minLength: 2, maxLength: 255 }).filter((s) => s.trim().length >= 2),
				email: validEmailArbitrary,
			})

			fc.assert(
				fc.property(validInputArbitrary, (input) => {
					const result = CreateCompanyInputSchema.safeParse(input)
					expect(result.success).toBe(true)
				}),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with name too short', () => {
			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 0, maxLength: 1 }),
						email: validEmailArbitrary,
					}),
					(input) => {
						const result = CreateCompanyInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with invalid email format', () => {
			const invalidEmailArbitrary = fc.oneof(
				fc.constant(''),
				fc.constant('notanemail'),
				fc.constant('@missing-local.com'),
				fc.constant('missing-domain@'),
			)

			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 2, maxLength: 255 }).filter((s) => s.trim().length >= 2),
						email: invalidEmailArbitrary,
					}),
					(input) => {
						const result = CreateCompanyInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * **Feature: agent-service-coverage, Property 25: DTO Validation Constraints**
	 * **Validates: Requirements 15.4**
	 *
	 * *For any* CreatePayPlanDto input, the Zod schema SHALL verify all pay plan fields.
	 */
	describe('CreatePayPlanDto Validation (Requirement 15.4)', () => {
		it('should accept any valid CreatePayPlan input', () => {
			const validInputArbitrary = fc.record({
				name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
				active: fc.boolean(),
				agentPercentage: fc.double({ min: 0, max: 100, noNaN: true }),
				cap: fc.double({ min: 0, max: 1000000, noNaN: true }),
			})

			fc.assert(
				fc.property(validInputArbitrary, (input) => {
					const result = CreatePayPlanInputSchema.safeParse(input)
					expect(result.success).toBe(true)
				}),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with agentPercentage out of range', () => {
			const invalidPercentageArbitrary = fc.oneof(
				fc.double({ min: -1000, max: -0.01, noNaN: true }),
				fc.double({ min: 100.01, max: 1000, noNaN: true }),
			)

			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
						active: fc.boolean(),
						agentPercentage: invalidPercentageArbitrary,
						cap: fc.double({ min: 0, max: 1000000, noNaN: true }),
					}),
					(input) => {
						const result = CreatePayPlanInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with negative cap', () => {
			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
						active: fc.boolean(),
						agentPercentage: fc.double({ min: 0, max: 100, noNaN: true }),
						cap: fc.double({ min: -1000, max: -0.01, noNaN: true }),
					}),
					(input) => {
						const result = CreatePayPlanInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should reject any input with missing required fields', () => {
			// Missing 'active' field
			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
						agentPercentage: fc.double({ min: 0, max: 100, noNaN: true }),
						cap: fc.double({ min: 0, max: 1000000, noNaN: true }),
					}),
					(input) => {
						const result = CreatePayPlanInputSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * **Feature: agent-service-coverage, Property 25: DTO Validation Constraints**
	 * **Validates: Requirements 15.5**
	 *
	 * *For any* pagination DTO input, the Zod schema SHALL verify offset and limit constraints.
	 */
	describe('Pagination DTO Validation (Requirement 15.5)', () => {
		it('should accept any valid pagination input within constraints', () => {
			const validPaginationArbitrary = fc.record({
				offset: fc.integer({ min: 0, max: 10000 }),
				limit: fc.integer({ min: 1, max: LIMIT_MAX }),
			})

			fc.assert(
				fc.property(validPaginationArbitrary, (input) => {
					const result = NormalizedPaginationSchema.safeParse(input)
					expect(result.success).toBe(true)
				}),
				{ numRuns: 100 },
			)
		})

		it('should reject any pagination with negative offset', () => {
			fc.assert(
				fc.property(
					fc.record({
						offset: fc.integer({ min: -1000, max: -1 }),
						limit: fc.integer({ min: 1, max: LIMIT_MAX }),
					}),
					(input) => {
						const result = NormalizedPaginationSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should clamp limit exceeding maximum via PaginationQuerySchema', () => {
			fc.assert(
				fc.property(
					fc.record({
						offset: fc.integer({ min: 0, max: 10000 }),
						limit: fc.integer({ min: LIMIT_MAX + 1, max: LIMIT_MAX + 1000 }),
					}),
					(input) => {
						// PaginationQuerySchema now clamps instead of rejecting
						const result = PaginationQuerySchema.safeParse(input)
						expect(result.success).toBe(true)
						if (result.success) {
							expect(result.data.limit).toBe(LIMIT_MAX) // Clamped to max
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should still reject limit exceeding maximum in NormalizedPaginationSchema (post-processing validation)', () => {
			// NormalizedPaginationSchema is used for already-processed data
			// It still validates the max constraint for data integrity
			fc.assert(
				fc.property(
					fc.record({
						offset: fc.integer({ min: 0, max: 10000 }),
						limit: fc.integer({ min: LIMIT_MAX + 1, max: LIMIT_MAX + 1000 }),
					}),
					(input) => {
						const result = NormalizedPaginationSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should reject any pagination with limit less than 1', () => {
			fc.assert(
				fc.property(
					fc.record({
						offset: fc.integer({ min: 0, max: 10000 }),
						limit: fc.integer({ min: -100, max: 0 }),
					}),
					(input) => {
						const result = NormalizedPaginationSchema.safeParse(input)
						expect(result.success).toBe(false)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should apply default values for PaginationQuerySchema', () => {
			// PaginationQuerySchema has defaults for offset (0) and limit (25)
			fc.assert(
				fc.property(fc.constant({}), (input) => {
					const result = PaginationQuerySchema.safeParse(input)
					expect(result.success).toBe(true)
					if (result.success) {
						expect(result.data.offset).toBe(0)
						expect(result.data.limit).toBe(25)
					}
				}),
				{ numRuns: 10 },
			)
		})

		it('should coerce string values to numbers for PaginationQuerySchema', () => {
			// PaginationQuerySchema uses z.coerce.number()
			fc.assert(
				fc.property(
					fc.record({
						offset: fc.integer({ min: 0, max: 1000 }).map(String),
						limit: fc.integer({ min: 1, max: LIMIT_MAX }).map(String),
					}),
					(input) => {
						const result = PaginationQuerySchema.safeParse(input)
						expect(result.success).toBe(true)
						if (result.success) {
							expect(typeof result.data.offset).toBe('number')
							expect(typeof result.data.limit).toBe('number')
						}
					},
				),
				{ numRuns: 100 },
			)
		})
	})
})
