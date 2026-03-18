/**
 * Property-Based Tests for ZodValidationPipe
 *
 * These tests verify universal properties that should hold across all valid inputs.
 *
 * **Feature: agent-service-coverage, Property 15: ZodValidationPipe Valid Input Passthrough**
 * **Feature: agent-service-coverage, Property 16: ZodValidationPipe Invalid Input Throws BadRequestException**
 * **Validates: Requirements 6.1, 6.2, 6.4**
 */

import * as fc from 'fast-check'
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from './zod-validation.pipe.js'

describe('ZodValidationPipe Property Tests', () => {
	/**
	 * **Feature: agent-service-coverage, Property 15: ZodValidationPipe Valid Input Passthrough**
	 * **Validates: Requirements 6.1**
	 *
	 * *For any* input that passes Zod schema validation, ZodValidationPipe.transform
	 * SHALL return the input unchanged (or with applied transformations like defaults).
	 */
	describe('Property 15: Valid Input Passthrough', () => {
		it('should pass through any valid string input unchanged', () => {
			const schema = z.object({
				name: z.string().min(1).max(255),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
					(name) => {
						const input = { name }
						const result = pipe.transform(input)
						expect(result).toEqual(input)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should pass through any valid number input unchanged', () => {
			const schema = z.object({
				count: z.number().min(0).max(1000),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(fc.integer({ min: 0, max: 1000 }), (count) => {
					const input = { count }
					const result = pipe.transform(input)
					expect(result).toEqual(input)
				}),
				{ numRuns: 100 },
			)
		})

		it('should pass through any valid boolean input unchanged', () => {
			const schema = z.object({
				active: z.boolean(),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(fc.boolean(), (active) => {
					const input = { active }
					const result = pipe.transform(input)
					expect(result).toEqual(input)
				}),
				{ numRuns: 100 },
			)
		})

		it('should pass through any valid email input unchanged', () => {
			const schema = z.object({
				email: z.string().email(),
			})
			const pipe = new ZodValidationPipe(schema)

			// Generate RFC 5322 compliant emails that Zod will accept
			// Zod's email validation is stricter than fast-check's emailAddress()
			const validEmailArbitrary = fc
				.tuple(
					fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/), // local part - alphanumeric only
					fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/), // domain - alphanumeric only
					fc.constantFrom('com', 'org', 'net', 'io', 'co'),
				)
				.map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

			fc.assert(
				fc.property(validEmailArbitrary, (email) => {
					const input = { email }
					const result = pipe.transform(input)
					expect(result).toEqual(input)
				}),
				{ numRuns: 100 },
			)
		})

		it('should pass through any valid UUID input unchanged', () => {
			const schema = z.object({
				id: z.string().uuid(),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(fc.uuid(), (id) => {
					const input = { id }
					const result = pipe.transform(input)
					expect(result).toEqual(input)
				}),
				{ numRuns: 100 },
			)
		})

		it('should pass through any valid complex object unchanged', () => {
			const schema = z.object({
				name: z.string().min(1).max(255),
				count: z.number().min(0).max(1000),
				active: z.boolean(),
				tags: z.array(z.string()).optional(),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(
					fc.record({
						name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
						count: fc.integer({ min: 0, max: 1000 }),
						active: fc.boolean(),
						tags: fc.option(fc.array(fc.string({ maxLength: 50 }), { maxLength: 5 }), {
							nil: undefined,
						}),
					}),
					(input) => {
						const result = pipe.transform(input)
						expect(result.name).toBe(input.name)
						expect(result.count).toBe(input.count)
						expect(result.active).toBe(input.active)
						if (input.tags !== undefined) {
							expect(result.tags).toEqual(input.tags)
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should apply default values when optional fields are missing', () => {
			const schema = z.object({
				name: z.string(),
				count: z.number().default(0),
				active: z.boolean().default(true),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
					(name) => {
						const input = { name }
						const result = pipe.transform(input)
						expect(result.name).toBe(name)
						expect(result.count).toBe(0)
						expect(result.active).toBe(true)
					},
				),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * **Feature: agent-service-coverage, Property 16: ZodValidationPipe Invalid Input Throws BadRequestException**
	 * **Validates: Requirements 6.2, 6.4**
	 *
	 * *For any* input that fails Zod schema validation, ZodValidationPipe.transform
	 * SHALL throw BadRequestException with _zodIssues array containing i18n error codes.
	 */
	describe('Property 16: Invalid Input Throws BadRequestException', () => {
		it('should throw BadRequestException for any type mismatch (string expected, number given)', () => {
			const schema = z.object({
				name: z.string(),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(fc.integer(), (invalidValue) => {
					try {
						pipe.transform({ name: invalidValue })
						fail('Should have thrown BadRequestException')
					} catch (error: any) {
						expect(error).toBeInstanceOf(BadRequestException)
						const response = error.getResponse()
						expect(response._zodIssues).toBeDefined()
						expect(Array.isArray(response._zodIssues)).toBe(true)
						expect(response._zodIssues.length).toBeGreaterThan(0)
						expect(response._zodIssues[0].message).toMatch(/^errors\.validation\./)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it('should throw BadRequestException for any type mismatch (number expected, string given)', () => {
			const schema = z.object({
				count: z.number(),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(
					fc.string({ minLength: 1 }).filter((s) => isNaN(Number(s))),
					(invalidValue) => {
						try {
							pipe.transform({ count: invalidValue })
							fail('Should have thrown BadRequestException')
						} catch (error: any) {
							expect(error).toBeInstanceOf(BadRequestException)
							const response = error.getResponse()
							expect(response._zodIssues).toBeDefined()
							expect(response._zodIssues[0].message).toBe('errors.validation.type.expected_number')
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should throw BadRequestException for any missing required field', () => {
			const schema = z.object({
				name: z.string(),
				email: z.string().email(),
				count: z.number(),
			})
			const pipe = new ZodValidationPipe(schema)

			// Generate partial objects missing at least one required field
			fc.assert(
				fc.property(
					fc.record({
						name: fc.option(fc.string(), { nil: undefined }),
						email: fc.option(fc.emailAddress(), { nil: undefined }),
						count: fc.option(fc.integer(), { nil: undefined }),
					}),
					(partialInput) => {
						// Only test when at least one field is missing
						const hasAllFields =
							partialInput.name !== undefined &&
							partialInput.email !== undefined &&
							partialInput.count !== undefined

						if (!hasAllFields) {
							try {
								pipe.transform(partialInput)
								fail('Should have thrown BadRequestException')
							} catch (error: any) {
								expect(error).toBeInstanceOf(BadRequestException)
								const response = error.getResponse()
								expect(response._zodIssues).toBeDefined()
								expect(response._zodIssues.length).toBeGreaterThan(0)
								// At least one issue should be about a required field
								const hasRequiredError = response._zodIssues.some(
									(issue: any) => issue.message === 'errors.validation.required',
								)
								expect(hasRequiredError).toBe(true)
							}
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should throw BadRequestException for any string below minimum length', () => {
			const minLength = 5
			const schema = z.object({
				name: z.string().min(minLength),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: minLength - 1 }),
					(shortString) => {
						try {
							pipe.transform({ name: shortString })
							fail('Should have thrown BadRequestException')
						} catch (error: any) {
							expect(error).toBeInstanceOf(BadRequestException)
							const response = error.getResponse()
							expect(response._zodIssues).toBeDefined()
							expect(response._zodIssues[0].message).toBe('errors.validation.string.min_length')
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should throw BadRequestException for any string above maximum length', () => {
			const maxLength = 10
			const schema = z.object({
				name: z.string().max(maxLength),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(fc.string({ minLength: maxLength + 1, maxLength: maxLength + 50 }), (longString) => {
					try {
						pipe.transform({ name: longString })
						fail('Should have thrown BadRequestException')
					} catch (error: any) {
						expect(error).toBeInstanceOf(BadRequestException)
						const response = error.getResponse()
						expect(response._zodIssues).toBeDefined()
						expect(response._zodIssues[0].message).toBe('errors.validation.string.max_length')
					}
				}),
				{ numRuns: 100 },
			)
		})

		it('should throw BadRequestException for any number below minimum', () => {
			const minValue = 10
			const schema = z.object({
				count: z.number().min(minValue),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(fc.integer({ min: -1000, max: minValue - 1 }), (smallNumber) => {
					try {
						pipe.transform({ count: smallNumber })
						fail('Should have thrown BadRequestException')
					} catch (error: any) {
						expect(error).toBeInstanceOf(BadRequestException)
						const response = error.getResponse()
						expect(response._zodIssues).toBeDefined()
						expect(response._zodIssues[0].message).toBe('errors.validation.number.too_small')
					}
				}),
				{ numRuns: 100 },
			)
		})

		it('should throw BadRequestException for any number above maximum', () => {
			const maxValue = 100
			const schema = z.object({
				count: z.number().max(maxValue),
			})
			const pipe = new ZodValidationPipe(schema)

			fc.assert(
				fc.property(fc.integer({ min: maxValue + 1, max: maxValue + 1000 }), (largeNumber) => {
					try {
						pipe.transform({ count: largeNumber })
						fail('Should have thrown BadRequestException')
					} catch (error: any) {
						expect(error).toBeInstanceOf(BadRequestException)
						const response = error.getResponse()
						expect(response._zodIssues).toBeDefined()
						expect(response._zodIssues[0].message).toBe('errors.validation.number.too_large')
					}
				}),
				{ numRuns: 100 },
			)
		})

		it('should include _i18nType in error response when provided', () => {
			const schema = z.object({
				name: z.string(),
			})

			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-z.]+$/.test(s)),
					(i18nType) => {
						const pipe = new ZodValidationPipe(schema, i18nType)

						try {
							pipe.transform({})
							fail('Should have thrown BadRequestException')
						} catch (error: any) {
							expect(error).toBeInstanceOf(BadRequestException)
							const response = error.getResponse()
							expect(response._i18nType).toBe(i18nType)
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should have all _zodIssues with i18n error codes', () => {
			const schema = z.object({
				name: z.string().min(1),
				email: z.string().email(),
				count: z.number().min(0),
			})
			const pipe = new ZodValidationPipe(schema)

			// Generate completely invalid input
			fc.assert(
				fc.property(
					fc.record({
						name: fc.constant(''),
						email: fc.constant('invalid'),
						count: fc.constant(-1),
					}),
					(invalidInput) => {
						try {
							pipe.transform(invalidInput)
							fail('Should have thrown BadRequestException')
						} catch (error: any) {
							expect(error).toBeInstanceOf(BadRequestException)
							const response = error.getResponse()
							expect(response._zodIssues).toBeDefined()

							// All issues should have i18n error codes
							response._zodIssues.forEach((issue: any) => {
								expect(issue.message).toMatch(/^errors\.validation\./)
							})
						}
					},
				),
				{ numRuns: 100 },
			)
		})
	})
})
