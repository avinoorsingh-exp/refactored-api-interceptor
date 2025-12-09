import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from './zod-validation.pipe.js'

describe('ZodValidationPipe', () => {
	describe('valid input passthrough', () => {
		it('should pass through valid primitive values unchanged', () => {
			const schema = z.object({
				name: z.string(),
				count: z.number(),
				active: z.boolean(),
			})

			const pipe = new ZodValidationPipe(schema)
			const input = { name: 'Test', count: 42, active: true }

			const result = pipe.transform(input)

			expect(result).toEqual(input)
		})

		it('should pass through valid nested objects unchanged', () => {
			const schema = z.object({
				user: z.object({
					name: z.string(),
					email: z.string().email(),
				}),
			})

			const pipe = new ZodValidationPipe(schema)
			const input = { user: { name: 'John', email: 'john@example.com' } }

			const result = pipe.transform(input)

			expect(result).toEqual(input)
		})

		it('should pass through valid arrays unchanged', () => {
			const schema = z.object({
				tags: z.array(z.string()),
			})

			const pipe = new ZodValidationPipe(schema)
			const input = { tags: ['a', 'b', 'c'] }

			const result = pipe.transform(input)

			expect(result).toEqual(input)
		})

		it('should pass through valid optional fields', () => {
			const schema = z.object({
				name: z.string(),
				description: z.string().optional(),
			})

			const pipe = new ZodValidationPipe(schema)
			const input = { name: 'Test' }

			const result = pipe.transform(input)

			expect(result).toEqual(input)
		})

		it('should apply default values for missing optional fields with defaults', () => {
			const schema = z.object({
				name: z.string(),
				count: z.number().default(0),
			})

			const pipe = new ZodValidationPipe(schema)
			const input = { name: 'Test' }

			const result = pipe.transform(input)

			expect(result).toEqual({ name: 'Test', count: 0 })
		})
	})

	describe('error message transformation', () => {
		it('should transform "Expected number, received string" to i18n code', () => {
			const schema = z.object({
				dialingCode: z.number(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ dialingCode: 'invalid' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['dialingCode'])
				expect(response._zodIssues[0].message).toBe('errors.validation.type.expected_number')
			}
		})

		it('should transform "Required" to i18n code for missing fields', () => {
			const schema = z.object({
				name: z.string(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({})
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['name'])
				expect(response._zodIssues[0].message).toBe('errors.validation.required')
			}
		})

		it('should transform string length validation to i18n code', () => {
			const schema = z.object({
				code: z.string().length(2),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ code: 'ABC' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['code'])
				expect(response._zodIssues[0].message).toBe('errors.validation.string.max_length')
			}
		})

		it('should transform email validation to i18n code', () => {
			const schema = z.object({
				email: z.string().email(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ email: 'not-an-email' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['email'])
				expect(response._zodIssues[0].message).toBe('errors.validation.string.invalid_email')
			}
		})

		it('should transform number too small validation to i18n code', () => {
			const schema = z.object({
				age: z.number().min(18),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ age: 10 })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['age'])
				expect(response._zodIssues[0].message).toBe('errors.validation.number.too_small')
			}
		})

		it('should transform regex validation to i18n code', () => {
			const schema = z.object({
				alpha2: z.string().regex(/^[A-Z]{2}$/),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ alpha2: 'abc' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['alpha2'])
				expect(response._zodIssues[0].message).toBe('errors.validation.string.invalid_format')
			}
		})

		it('should preserve custom i18nType when provided', () => {
			const schema = z.object({
				name: z.string(),
			})

			const pipe = new ZodValidationPipe(schema, 'agent.country.validation')

			try {
				pipe.transform({})
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._i18nType).toBe('agent.country.validation')
			}
		})

		it('should allow valid data to pass through', () => {
			const schema = z.object({
				name: z.string(),
				dialingCode: z.number(),
			})

			const pipe = new ZodValidationPipe(schema)

			const result = pipe.transform({ name: 'Test', dialingCode: 1 })

			expect(result).toEqual({ name: 'Test', dialingCode: 1 })
		})

		it('should transform URL validation to i18n code', () => {
			const schema = z.object({
				website: z.string().url(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ website: 'not-a-url' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['website'])
				expect(response._zodIssues[0].message).toBe('errors.validation.string.invalid_url')
			}
		})

		it('should transform UUID validation to i18n code', () => {
			const schema = z.object({
				id: z.string().uuid(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ id: 'not-a-uuid' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['id'])
				expect(response._zodIssues[0].message).toBe('errors.validation.string.invalid_uuid')
			}
		})

		it('should transform enum validation to i18n code', () => {
			const schema = z.object({
				status: z.enum(['active', 'inactive', 'pending']),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ status: 'invalid' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['status'])
				expect(response._zodIssues[0].message).toBe('errors.validation.invalid_enum')
			}
		})

		it('should transform number too large validation to i18n code', () => {
			const schema = z.object({
				percentage: z.number().max(100),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ percentage: 150 })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['percentage'])
				expect(response._zodIssues[0].message).toBe('errors.validation.number.too_large')
			}
		})

		it('should transform boolean type mismatch to i18n code', () => {
			const schema = z.object({
				active: z.boolean(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ active: 'yes' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['active'])
				expect(response._zodIssues[0].message).toBe('errors.validation.type.expected_boolean')
			}
		})

		it('should transform date validation to i18n code', () => {
			const schema = z.object({
				createdAt: z.coerce.date(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ createdAt: 'not-a-date' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['createdAt'])
				expect(response._zodIssues[0].message).toBe('errors.validation.invalid_date')
			}
		})

		it('should transform string min length validation to i18n code', () => {
			const schema = z.object({
				name: z.string().min(3),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ name: 'ab' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['name'])
				expect(response._zodIssues[0].message).toBe('errors.validation.string.min_length')
			}
		})

		it('should transform array type mismatch to i18n code', () => {
			const schema = z.object({
				items: z.array(z.string()),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ items: 'not-an-array' })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['items'])
				expect(response._zodIssues[0].message).toBe('errors.validation.type.expected_array')
			}
		})

		it('should not include _i18nType when not provided', () => {
			const schema = z.object({
				name: z.string(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({})
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response._zodIssues).toBeDefined()
				expect(response._i18nType).toBeUndefined()
			}
		})
	})

	describe('multiple field validation', () => {
		it('should return i18n codes for all invalid fields', () => {
			const schema = z.object({
				name: z.string(),
				alpha2: z.string().length(2),
				dialingCode: z.number(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({
					alpha2: 'TOO_LONG',
					dialingCode: 'not_a_number',
				})
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues.length).toBe(3)
				
				// Find specific issues
				const nameIssue = response._zodIssues.find((i: any) => i.path[0] === 'name')
				const alpha2Issue = response._zodIssues.find((i: any) => i.path[0] === 'alpha2')
				const dialingCodeIssue = response._zodIssues.find((i: any) => i.path[0] === 'dialingCode')
				
				expect(nameIssue.message).toBe('errors.validation.required')
				expect(alpha2Issue.message).toBe('errors.validation.string.max_length')
				expect(dialingCodeIssue.message).toBe('errors.validation.type.expected_number')
			}
		})
	})

	describe('invalidParams array extraction', () => {
		it('should include _zodIssues array in error response', () => {
			const schema = z.object({
				number: z.number().int().min(1),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ number: -50 })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				
				// Should have _zodIssues array
				expect(response._zodIssues).toBeDefined()
				expect(Array.isArray(response._zodIssues)).toBe(true)
				expect(response._zodIssues.length).toBeGreaterThan(0)
				
				// Should contain issue details
				const issue = response._zodIssues[0]
				expect(issue.path).toEqual(['number'])
				expect(issue.message).toBe('errors.validation.number.too_small')
				expect(issue.code).toBeDefined()
			}
		})

		it('should include multiple issues in _zodIssues array', () => {
			const schema = z.object({
				alpha2: z.string().length(2).regex(/^[A-Z]{2}$/),
				number: z.number().int().min(1).max(999),
				dialingCode: z.number().int().positive(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({
					alpha2: 'TOOLONG',
					number: -50,
					dialingCode: 'invalid',
				})
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				
				expect(response._zodIssues).toBeDefined()
				expect(Array.isArray(response._zodIssues)).toBe(true)
				// alpha2 fails both length AND regex (2 issues), number fails (1 issue), dialingCode fails (1 issue) = 4 total
				expect(response._zodIssues.length).toBe(4)
				
				// Check each issue has proper structure
				response._zodIssues.forEach((issue: any) => {
					expect(issue).toHaveProperty('path')
					expect(issue).toHaveProperty('message')
					expect(issue).toHaveProperty('code')
					expect(Array.isArray(issue.path)).toBe(true)
				})
			}
		})

		it('should include _i18nType when provided', () => {
			const schema = z.object({
				name: z.string(),
			})

			const pipe = new ZodValidationPipe(schema, 'agent.country.validation')

			try {
				pipe.transform({})
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				
				expect(response._zodIssues).toBeDefined()
				expect(response._i18nType).toBe('agent.country.validation')
			}
		})

		it('should handle nested object validation', () => {
			const schema = z.object({
				address: z.object({
					city: z.string().min(1),
					zipCode: z.string().regex(/^\d{5}$/),
				}),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({
					address: {
						city: '',
						zipCode: 'INVALID',
					},
				})
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues.length).toBe(2)
				
				// Check nested paths
				const cityIssue = response._zodIssues.find((i: any) => 
					i.path.join('.') === 'address.city'
				)
				const zipIssue = response._zodIssues.find((i: any) => 
					i.path.join('.') === 'address.zipCode'
				)
				
				expect(cityIssue).toBeDefined()
				expect(zipIssue).toBeDefined()
			}
		})

		it('should handle array validation', () => {
			const schema = z.object({
				tags: z.array(z.string().min(1)).min(1),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ tags: [] })
				fail('Should have thrown BadRequestException')
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				
				expect(response._zodIssues).toBeDefined()
				expect(response._zodIssues[0].path).toEqual(['tags'])
			}
		})
	})
})
