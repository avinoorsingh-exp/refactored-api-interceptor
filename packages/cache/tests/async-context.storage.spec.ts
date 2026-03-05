import { describe, it, expect } from '@jest/globals'
import * as fc from 'fast-check'
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

		it('should execute callback with context', () => {
			let callbackExecuted = false
			const result = AsyncContextStorage.run(
				{
					correlationId: 'callback-test',
					timestamp: Date.now(),
				},
				() => {
					callbackExecuted = true
					return 'callback-result'
				},
			)

			expect(callbackExecuted).toBe(true)
			expect(result).toBe('callback-result')
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

		it('should return correct ID in nested contexts', () => {
			AsyncContextStorage.run(
				{
					correlationId: 'outer-context',
					timestamp: Date.now(),
				},
				() => {
					expect(AsyncContextStorage.getCorrelationId()).toBe('outer-context')

					// Nested context with different ID
					AsyncContextStorage.run(
						{
							correlationId: 'inner-context',
							timestamp: Date.now(),
						},
						() => {
							expect(AsyncContextStorage.getCorrelationId()).toBe('inner-context')
						},
					)

					// Back to outer context
					expect(AsyncContextStorage.getCorrelationId()).toBe('outer-context')
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

	describe('context isolation', () => {
		it('should isolate concurrent run() calls', async () => {
			const results: string[] = []

			// Create 10 concurrent contexts with different correlation IDs
			const promises = Array.from({ length: 10 }, (_, i) => {
				const correlationId = `concurrent-${i}`
				return AsyncContextStorage.run(
					{
						correlationId,
						timestamp: Date.now(),
					},
					async () => {
						// Simulate async work
						await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))

						const retrievedId = AsyncContextStorage.getCorrelationId()
						results.push(retrievedId!)

						// Verify the ID matches what we set
						expect(retrievedId).toBe(correlationId)

						return retrievedId
					},
				)
			})

			await Promise.all(promises)

			// Verify all 10 contexts maintained their own correlation IDs
			expect(results).toHaveLength(10)
			for (let i = 0; i < 10; i++) {
				expect(results).toContain(`concurrent-${i}`)
			}
		})

		it('should maintain separate contexts for each concurrent request', async () => {
			const context1Results: string[] = []
			const context2Results: string[] = []

			const promise1 = AsyncContextStorage.run(
				{
					correlationId: 'context-1',
					timestamp: Date.now(),
				},
				async () => {
					for (let i = 0; i < 5; i++) {
						await new Promise((resolve) => setTimeout(resolve, 5))
						const id = AsyncContextStorage.getCorrelationId()
						context1Results.push(id!)
					}
				},
			)

			const promise2 = AsyncContextStorage.run(
				{
					correlationId: 'context-2',
					timestamp: Date.now(),
				},
				async () => {
					for (let i = 0; i < 5; i++) {
						await new Promise((resolve) => setTimeout(resolve, 5))
						const id = AsyncContextStorage.getCorrelationId()
						context2Results.push(id!)
					}
				},
			)

			await Promise.all([promise1, promise2])

			// Verify no cross-contamination
			expect(context1Results).toHaveLength(5)
			expect(context2Results).toHaveLength(5)
			expect(context1Results.every((id) => id === 'context-1')).toBe(true)
			expect(context2Results.every((id) => id === 'context-2')).toBe(true)
		})
	})

	describe('async context preservation', () => {
		it('should preserve correlation ID in setTimeout callback', async () => {
			await AsyncContextStorage.run(
				{
					correlationId: 'setTimeout-test',
					timestamp: Date.now(),
				},
				async () => {
					const idBeforeTimeout = AsyncContextStorage.getCorrelationId()
					expect(idBeforeTimeout).toBe('setTimeout-test')

					await new Promise<void>((resolve) => {
						setTimeout(() => {
							const idInTimeout = AsyncContextStorage.getCorrelationId()
							expect(idInTimeout).toBe('setTimeout-test')
							resolve()
						}, 10)
					})
				},
			)
		})

		it('should preserve correlation ID in Promise.then callback', async () => {
			await AsyncContextStorage.run(
				{
					correlationId: 'promise-then-test',
					timestamp: Date.now(),
				},
				async () => {
					const idBefore = AsyncContextStorage.getCorrelationId()
					expect(idBefore).toBe('promise-then-test')

					await Promise.resolve('test-value').then(() => {
						const idInThen = AsyncContextStorage.getCorrelationId()
						expect(idInThen).toBe('promise-then-test')
					})
				},
			)
		})

		it('should preserve correlation ID in async/await functions', async () => {
			await AsyncContextStorage.run(
				{
					correlationId: 'async-await-test',
					timestamp: Date.now(),
				},
				async () => {
					const idBefore = AsyncContextStorage.getCorrelationId()
					expect(idBefore).toBe('async-await-test')

					const asyncFunction = async () => {
						await new Promise((resolve) => setTimeout(resolve, 10))
						return AsyncContextStorage.getCorrelationId()
					}

					const idInAsync = await asyncFunction()
					expect(idInAsync).toBe('async-await-test')
				},
			)
		})

		it('should preserve correlation ID in Promise.all', async () => {
			await AsyncContextStorage.run(
				{
					correlationId: 'promise-all-test',
					timestamp: Date.now(),
				},
				async () => {
					const promises = [
						Promise.resolve().then(() => AsyncContextStorage.getCorrelationId()),
						new Promise((resolve) =>
							setTimeout(() => resolve(AsyncContextStorage.getCorrelationId()), 10),
						),
						(async () => {
							await new Promise((resolve) => setTimeout(resolve, 5))
							return AsyncContextStorage.getCorrelationId()
						})(),
					]

					const results = await Promise.all(promises)

					expect(results).toHaveLength(3)
					expect(results.every((id) => id === 'promise-all-test')).toBe(true)
				},
			)
		})

		it('should preserve correlation ID through nested async operations', async () => {
			await AsyncContextStorage.run(
				{
					correlationId: 'nested-async-test',
					timestamp: Date.now(),
				},
				async () => {
					const level1 = async () => {
						await new Promise((resolve) => setTimeout(resolve, 5))
						const id1 = AsyncContextStorage.getCorrelationId()
						expect(id1).toBe('nested-async-test')

						const level2 = async () => {
							await new Promise((resolve) => setTimeout(resolve, 5))
							const id2 = AsyncContextStorage.getCorrelationId()
							expect(id2).toBe('nested-async-test')

							const level3 = async () => {
								await new Promise((resolve) => setTimeout(resolve, 5))
								const id3 = AsyncContextStorage.getCorrelationId()
								expect(id3).toBe('nested-async-test')
								return id3
							}

							return await level3()
						}

						return await level2()
					}

					const finalId = await level1()
					expect(finalId).toBe('nested-async-test')
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

	describe('Property-Based Tests', () => {
		/**
		 * Property 8: Concurrent Request Context Isolation
		 * Validates: Requirements 5.1
		 */
		it('should isolate concurrent contexts with arbitrary correlation IDs', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
					async (correlationIds) => {
						const results = new Map<string, string[]>()

						// Initialize results map
						correlationIds.forEach((id) => {
							results.set(id, [])
						})

						// Create concurrent contexts
						const promises = correlationIds.map((correlationId) =>
							AsyncContextStorage.run(
								{
									correlationId,
									timestamp: Date.now(),
								},
								async () => {
									// Simulate async work with random delay
									await new Promise((resolve) =>
										setTimeout(resolve, Math.random() * 10),
									)

									const retrievedId = AsyncContextStorage.getCorrelationId()

									// Store the retrieved ID
									if (retrievedId) {
										const arr = results.get(correlationId)
										if (arr) {
											arr.push(retrievedId)
										}
									}

									return retrievedId
								},
							),
						)

						await Promise.all(promises)

						// Verify no cross-contamination
						correlationIds.forEach((correlationId) => {
							const retrievedIds = results.get(correlationId) || []
							expect(retrievedIds).toHaveLength(1)
							expect(retrievedIds[0]).toBe(correlationId)
						})
					},
				),
				{ numRuns: 100 },
			)
		})

		/**
		 * Property 9: Async Operation Context Preservation
		 * Validates: Requirements 4.4, 5.2, 5.4
		 */
		it('should preserve correlation ID through arbitrary async operation chains', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.uuid(),
					fc.integer({ min: 1, max: 5 }),
					async (correlationId, depth) => {
						await AsyncContextStorage.run(
							{
								correlationId,
								timestamp: Date.now(),
							},
							async () => {
								// Create nested async operations based on depth
								const createAsyncChain = async (currentDepth: number): Promise<string> => {
									if (currentDepth === 0) {
										return AsyncContextStorage.getCorrelationId() || 'undefined'
									}

									// Random async operation type
									const operationType = currentDepth % 4

									if (operationType === 0) {
										// setTimeout
										return new Promise((resolve) => {
											setTimeout(async () => {
												const id = AsyncContextStorage.getCorrelationId()
												expect(id).toBe(correlationId)
												const result = await createAsyncChain(currentDepth - 1)
												resolve(result)
											}, 5)
										})
									} else if (operationType === 1) {
										// Promise.then
										return Promise.resolve().then(async () => {
											const id = AsyncContextStorage.getCorrelationId()
											expect(id).toBe(correlationId)
											return await createAsyncChain(currentDepth - 1)
										})
									} else if (operationType === 2) {
										// async/await
										await new Promise((resolve) => setTimeout(resolve, 5))
										const id = AsyncContextStorage.getCorrelationId()
										expect(id).toBe(correlationId)
										return await createAsyncChain(currentDepth - 1)
									} else {
										// Promise.all
										const results = await Promise.all([
											Promise.resolve(AsyncContextStorage.getCorrelationId()),
											createAsyncChain(currentDepth - 1),
										])
										expect(results[0]).toBe(correlationId)
										return results[1]
									}
								}

								const finalId = await createAsyncChain(depth)
								expect(finalId).toBe(correlationId)
							},
						)
					},
				),
				{ numRuns: 100 },
			)
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
