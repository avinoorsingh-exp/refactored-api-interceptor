import {
	UUID_V4_REGEX,
	isValidUuidV4,
	generateValidCorrelationId,
	generateEmptyCorrelationId,
	generateLongCorrelationId,
	generateCorrelationIdWithNewline,
	generateCorrelationIdWithCarriageReturn,
	generateMaxLengthCorrelationId,
	createMockRequestContext,
	createMinimalRequestContext,
	generateUniqueCorrelationIds,
	areAllUnique,
} from './correlation-id-test-utils.js'

describe('Correlation ID Test Utilities', () => {
	describe('UUID_V4_REGEX', () => {
		it('should match valid UUID v4 format', () => {
			const validUuid = '550e8400-e29b-41d4-a716-446655440000'
			expect(UUID_V4_REGEX.test(validUuid)).toBe(true)
		})

		it('should not match invalid UUID formats', () => {
			expect(UUID_V4_REGEX.test('not-a-uuid')).toBe(false)
			expect(UUID_V4_REGEX.test('550e8400-e29b-31d4-a716-446655440000')).toBe(false) // version 3, not 4
			expect(UUID_V4_REGEX.test('')).toBe(false)
		})
	})

	describe('isValidUuidV4', () => {
		it('should validate UUID v4 format', () => {
			const validUuid = generateValidCorrelationId()
			expect(isValidUuidV4(validUuid)).toBe(true)
		})

		it('should reject invalid formats', () => {
			expect(isValidUuidV4('invalid')).toBe(false)
			expect(isValidUuidV4('')).toBe(false)
		})
	})

	describe('generateValidCorrelationId', () => {
		it('should generate valid UUID v4', () => {
			const id = generateValidCorrelationId()
			expect(isValidUuidV4(id)).toBe(true)
		})

		it('should generate unique IDs', () => {
			const id1 = generateValidCorrelationId()
			const id2 = generateValidCorrelationId()
			expect(id1).not.toBe(id2)
		})
	})

	describe('generateEmptyCorrelationId', () => {
		it('should return empty string', () => {
			expect(generateEmptyCorrelationId()).toBe('')
		})
	})

	describe('generateLongCorrelationId', () => {
		it('should generate string longer than 100 characters by default', () => {
			const id = generateLongCorrelationId()
			expect(id.length).toBe(101)
		})

		it('should generate string of specified length', () => {
			const id = generateLongCorrelationId(150)
			expect(id.length).toBe(150)
		})
	})

	describe('generateCorrelationIdWithNewline', () => {
		it('should contain newline character', () => {
			const id = generateCorrelationIdWithNewline()
			expect(id).toContain('\n')
		})
	})

	describe('generateCorrelationIdWithCarriageReturn', () => {
		it('should contain carriage return character', () => {
			const id = generateCorrelationIdWithCarriageReturn()
			expect(id).toContain('\r')
		})
	})

	describe('generateMaxLengthCorrelationId', () => {
		it('should generate exactly 100 characters', () => {
			const id = generateMaxLengthCorrelationId()
			expect(id.length).toBe(100)
		})
	})

	describe('createMockRequestContext', () => {
		it('should create context with all fields', () => {
			const context = createMockRequestContext()
			expect(context.correlationId).toBeDefined()
			expect(isValidUuidV4(context.correlationId)).toBe(true)
			expect(context.timestamp).toBeDefined()
			expect(context.userId).toBe('test-user-123')
			expect(context.requestPath).toBe('/v1/test')
			expect(context.method).toBe('GET')
			expect(context.ip).toBe('127.0.0.1')
		})

		it('should allow overriding fields', () => {
			const context = createMockRequestContext({
				correlationId: 'custom-id',
				method: 'POST',
			})
			expect(context.correlationId).toBe('custom-id')
			expect(context.method).toBe('POST')
			expect(context.userId).toBe('test-user-123') // default preserved
		})
	})

	describe('createMinimalRequestContext', () => {
		it('should create context with only required fields', () => {
			const context = createMinimalRequestContext()
			expect(context.correlationId).toBeDefined()
			expect(isValidUuidV4(context.correlationId)).toBe(true)
			expect(context.timestamp).toBeDefined()
			expect(context.userId).toBeUndefined()
			expect(context.requestPath).toBeUndefined()
		})

		it('should use provided correlation ID', () => {
			const customId = 'custom-correlation-id'
			const context = createMinimalRequestContext(customId)
			expect(context.correlationId).toBe(customId)
		})
	})

	describe('generateUniqueCorrelationIds', () => {
		it('should generate specified number of IDs', () => {
			const ids = generateUniqueCorrelationIds(10)
			expect(ids.length).toBe(10)
		})

		it('should generate unique IDs', () => {
			const ids = generateUniqueCorrelationIds(100)
			expect(areAllUnique(ids)).toBe(true)
		})

		it('should generate valid UUID v4 IDs', () => {
			const ids = generateUniqueCorrelationIds(5)
			ids.forEach((id) => {
				expect(isValidUuidV4(id)).toBe(true)
			})
		})
	})

	describe('areAllUnique', () => {
		it('should return true for unique items', () => {
			expect(areAllUnique([1, 2, 3, 4, 5])).toBe(true)
			expect(areAllUnique(['a', 'b', 'c'])).toBe(true)
		})

		it('should return false for duplicate items', () => {
			expect(areAllUnique([1, 2, 2, 3])).toBe(false)
			expect(areAllUnique(['a', 'b', 'a'])).toBe(false)
		})

		it('should return true for empty array', () => {
			expect(areAllUnique([])).toBe(true)
		})
	})
})
