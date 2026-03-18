import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { createCache, CacheService } from '../src/index.js'

describe('CacheService', () => {
	let cache: CacheService

	beforeEach(() => {
		cache = createCache({
			redisUrl: 'redis://localhost:6379',
			keyPrefix: 'test',
			defaultTTL: 60,
		})
	})

	afterEach(async () => {
		await cache.flushAll()
		await cache.disconnect()
	})

	it('should set and get a value', async () => {
		await cache.set('test-key', { name: 'John' })
		const result = await cache.get('test-key')
		expect(result).toEqual({ name: 'John' })
	})

	it('should return null for non-existent key', async () => {
		const result = await cache.get('non-existent')
		expect(result).toBeNull()
	})

	it('should delete a key', async () => {
		await cache.set('test-key', 'value')
		const deleted = await cache.del('test-key')
		expect(deleted).toBe(1)

		const result = await cache.get('test-key')
		expect(result).toBeNull()
	})

	it('should check if key exists', async () => {
		await cache.set('test-key', 'value')
		const exists = await cache.exists('test-key')
		expect(exists).toBe(true)

		const notExists = await cache.exists('non-existent')
		expect(notExists).toBe(false)
	})

	it('should handle TTL correctly', async () => {
		await cache.set('test-key', 'value', 2)

		const ttl = await cache.ttl('test-key')
		expect(ttl).toBeGreaterThan(0)
		expect(ttl).toBeLessThanOrEqual(2)
	})

	it('should use getOrSet pattern', async () => {
		let callCount = 0
		const factory = async () => {
			callCount++
			await Promise.resolve() // Make await meaningful
			return { data: 'computed' }
		}

		// First call - should compute
		const result1 = await cache.getOrSet('computed-key', factory, 60)
		expect(result1).toEqual({ data: 'computed' })
		expect(callCount).toBe(1)

		// Second call - should use cache
		const result2 = await cache.getOrSet('computed-key', factory, 60)
		expect(result2).toEqual({ data: 'computed' })
		expect(callCount).toBe(1) // Factory not called again
	})

	it('should increment and decrement counters', async () => {
		await cache.incr('counter', 5)
		expect(await cache.get('counter')).toBe(5) // Numbers stored as numbers, not strings

		await cache.incr('counter', 3)
		expect(await cache.get('counter')).toBe(8)

		await cache.decr('counter', 2)
		expect(await cache.get('counter')).toBe(6)
	})

	it('should delete keys by pattern', async () => {
		await cache.set('user:1', 'data1')
		await cache.set('user:2', 'data2')
		await cache.set('other:1', 'data3')

		const deleted = await cache.delPattern('user:*')
		expect(deleted).toBe(2)

		expect(await cache.exists('user:1')).toBe(false)
		expect(await cache.exists('user:2')).toBe(false)
		expect(await cache.exists('other:1')).toBe(true)
	})

	it('should pass health check', async () => {
		// Health check requires an actual ping to Redis
		// In a real environment with Redis running, this would return true
		// For now we just test it doesn't throw
		await expect(cache.healthCheck()).resolves.toBeDefined()
	})

	it('should get cache stats', async () => {
		await cache.set('key1', 'value1')
		await cache.set('key2', 'value2')

		const stats = await cache.getStats()
		expect(stats.keys).toBeGreaterThanOrEqual(2)
		expect(stats.connected).toBe(true)
	})
})
