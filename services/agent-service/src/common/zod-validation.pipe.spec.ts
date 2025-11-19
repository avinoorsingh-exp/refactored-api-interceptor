import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from './zod-validation.pipe.js'

describe('ZodValidationPipe', () => {
	describe('error message transformation', () => {
		it('should transform "Expected number, received string" to i18n code', () => {
			const schema = z.object({
				dialingCode: z.number(),
			})

			const pipe = new ZodValidationPipe(schema)

			try {
				pipe.transform({ dialingCode: 'invalid' })
				fail('Should have thrown BadRequestException')
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response.dialingCode._errors[0]).toBe('errors.validation.type.expected_number')
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
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response.name._errors[0]).toBe('errors.validation.required')
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
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				// Too long
				expect(response.code._errors[0]).toBe('errors.validation.string.max_length')
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
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response.email._errors[0]).toBe('errors.validation.string.invalid_email')
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
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response.age._errors[0]).toBe('errors.validation.number.too_small')
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
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				expect(response.alpha2._errors[0]).toBe('errors.validation.string.invalid_format')
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
			} catch (error) {
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
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				const response = error.getResponse() as any
				
				// Missing required field
				expect(response.name._errors[0]).toBe('errors.validation.required')
				// String too long
				expect(response.alpha2._errors[0]).toBe('errors.validation.string.max_length')
				// Wrong type
				expect(response.dialingCode._errors[0]).toBe('errors.validation.type.expected_number')
			}
		})
	})
})
