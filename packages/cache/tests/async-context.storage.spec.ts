import { describe, it, expect } from '@jest/globals'
import { AsyncContextStorage, CorrelationIdHelper } from '../src/async-context.storage.js'

describe('AsyncContextStorage', () => {
	describe('getStore', () => {
		it('should return undefined when not in a context', () => {
			expect(AsyncContextStorage.getStore()).toBeUndefined()
		})

		it('should return context when inside run()', () => {
			AsyncContextStorage.run(
				{
					correlationId: 'test-123',
					timestamp: Date.now(),
				},
				() => {
					const store = AsyncContextStorage.getStore()
					expect(store).toBeDefined()
					expect(store?.correlationId).toBe('test-123')
				},
			)
		})
	})

	describe('getCorrelationId', () => {
		it('should return undefined outside context', () => {
			expect(AsyncContextStorage.getCorrelationId()).toBeUndefined()
		})

		it('should return correlation ID inside context', () => {
			AsyncContextStorage.run(
				{
					correlationId: 'abc-456',
					timestamp: Date.now(),
				},
				() => {
					expect(AsyncContextStorage.getCorrelationId()).toBe('abc-456')
				},
			)
		})
	})

	describe('getContext', () => {
		it('should return full context with all metadata', () => {
			const context = {
				correlationId: 'ctx-789',
				userId: 'user-123',
				requestPath: '/api/test',
				method: 'GET',
				ip: '127.0.0.1',
				timestamp: Date.now(),
			}

			AsyncContextStorage.run(context, () => {
				const retrieved = AsyncContextStorage.getContext()
				expect(retrieved).toEqual(context)
			})
		})
	})

	describe('updateContext', () => {
		it('should merge updates into existing context', () => {
			AsyncContextStorage.run(
				{
					correlationId: 'update-test',
					timestamp: Date.now(),
				},
				() => {
					AsyncContextStorage.updateContext({ userId: 'user-456' })

					const context = AsyncContextStorage.getContext()
					expect(context?.correlationId).toBe('update-test')
					expect(context?.userId).toBe('user-456')
				},
			)
		})
	})

	describe('nested async operations', () => {
		it('should maintain context through async operations', async () => {
			const result = await AsyncContextStorage.run(
				{
					correlationId: 'async-test',
					timestamp: Date.now(),
				},
				async () => {
					// Simulate async operation
					await new Promise((resolve) => setTimeout(resolve, 10))

					const id = AsyncContextStorage.getCorrelationId()
					expect(id).toBe('async-test')

					// Nested async call
					const nested = await Promise.resolve('nested-result')
					const idAfterNested = AsyncContextStorage.getCorrelationId()
					expect(idAfterNested).toBe('async-test')

					return nested
				},
			)

			expect(result).toBe('nested-result')
		})
	})
})

describe('CorrelationIdHelper', () => {
	describe('extractCorrelationId', () => {
		it('should return incoming ID if valid', () => {
			const incomingId = 'valid-correlation-id-123'
			const result = CorrelationIdHelper.extractCorrelationId(incomingId)
			expect(result).toBe(incomingId)
		})

		it('should generate new ID if incoming is undefined', () => {
			const result = CorrelationIdHelper.extractCorrelationId()
			expect(result).toBeDefined()
			expect(typeof result).toBe('string')
			expect(result.length).toBeGreaterThan(0)
		})

		it('should generate new ID if incoming is empty', () => {
			const result = CorrelationIdHelper.extractCorrelationId('')
			expect(result).toBeDefined()
			expect(result).not.toBe('')
		})

		it('should generate new ID if incoming has newlines (security)', () => {
			const result = CorrelationIdHelper.extractCorrelationId('test\nmalicious')
			expect(result).not.toContain('\n')
			expect(result).not.toBe('test\nmalicious')
		})

		it('should generate new ID if incoming is too long', () => {
			const longId = 'x'.repeat(101)
			const result = CorrelationIdHelper.extractCorrelationId(longId)
			expect(result.length).toBeLessThanOrEqual(100)
		})
	})

	describe('generateCorrelationId', () => {
		it('should generate UUID v4 format', () => {
			const id = CorrelationIdHelper.generateCorrelationId()
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
			expect(id).toMatch(uuidRegex)
		})

		it('should generate unique IDs', () => {
			const id1 = CorrelationIdHelper.generateCorrelationId()
			const id2 = CorrelationIdHelper.generateCorrelationId()
			expect(id1).not.toBe(id2)
		})
	})

	describe('isValidCorrelationId', () => {
		it('should accept valid correlation IDs', () => {
			expect(CorrelationIdHelper.isValidCorrelationId('valid-id-123')).toBe(true)
			expect(CorrelationIdHelper.isValidCorrelationId('abc-def-ghi')).toBe(true)
		})

		it('should reject empty string', () => {
			expect(CorrelationIdHelper.isValidCorrelationId('')).toBe(false)
		})

		it('should reject IDs with newlines', () => {
			expect(CorrelationIdHelper.isValidCorrelationId('test\n')).toBe(false)
			expect(CorrelationIdHelper.isValidCorrelationId('test\r\n')).toBe(false)
		})

		it('should reject IDs over 100 chars', () => {
			const longId = 'x'.repeat(101)
			expect(CorrelationIdHelper.isValidCorrelationId(longId)).toBe(false)
		})

		it('should accept IDs exactly 100 chars', () => {
			const exactId = 'x'.repeat(100)
			expect(CorrelationIdHelper.isValidCorrelationId(exactId)).toBe(true)
		})
	})

	describe('runInContext', () => {
		it('should run callback in correlation context', () => {
			const result = CorrelationIdHelper.runInContext(
				'context-123',
				{
					requestPath: '/api/test',
					method: 'POST',
				},
				() => {
					const id = CorrelationIdHelper.getCorrelationId()
					expect(id).toBe('context-123')

					const path = AsyncContextStorage.getRequestPath()
					expect(path).toBe('/api/test')

					const method = AsyncContextStorage.getMethod()
					expect(method).toBe('POST')

					return 'success'
				},
			)

			expect(result).toBe('success')
		})

		it('should set timestamp automatically', () => {
			const beforeTimestamp = Date.now()

			CorrelationIdHelper.runInContext('time-test', {}, () => {
				const timestamp = AsyncContextStorage.getTimestamp()
				expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp)
				expect(timestamp).toBeLessThanOrEqual(Date.now())
			})
		})

		it('should return callback result', () => {
			const result = CorrelationIdHelper.runInContext('result-test', {}, () => {
				return { status: 'ok', data: [1, 2, 3] }
			})

			expect(result).toEqual({ status: 'ok', data: [1, 2, 3] })
		})
	})

	describe('getCorrelationId', () => {
		it('should return undefined outside context', () => {
			expect(CorrelationIdHelper.getCorrelationId()).toBeUndefined()
		})

		it('should return ID inside context', () => {
			CorrelationIdHelper.runInContext('get-test', {}, () => {
				expect(CorrelationIdHelper.getCorrelationId()).toBe('get-test')
			})
		})
	})

	describe('getOrGenerateCorrelationId', () => {
		it('should return existing ID from context', () => {
			CorrelationIdHelper.runInContext('existing-123', {}, () => {
				const id = CorrelationIdHelper.getOrGenerateCorrelationId()
				expect(id).toBe('existing-123')
			})
		})

		it('should generate new ID if not in context', () => {
			const id = CorrelationIdHelper.getOrGenerateCorrelationId()
			expect(id).toBeDefined()
			expect(typeof id).toBe('string')
			expect(id.length).toBeGreaterThan(0)
		})
	})
})
