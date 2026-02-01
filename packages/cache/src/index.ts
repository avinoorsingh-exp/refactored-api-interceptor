import { Redis, RedisOptions } from 'ioredis'
import type { Logger } from '@exprealty/logger'

// Export async context storage functionality
export { AsyncContextStorage, CorrelationIdHelper } from './async-context.storage.js'
export type { RequestContext, LoggerContext } from './async-context.storage.js'

// Export constants
export * from './constants.js'

// Export types
export type * from './types.js'

export interface CacheOptions {
	redisUrl?: string
	redisPassword?: string
	redisTls?: boolean
	keyPrefix?: string
	defaultTTL?: number // seconds
	logger?: Logger
	onError?: (error: Error) => void
}

export interface CacheEntry<T = unknown> {
	value: T
	expiresAt: number
	createdAt: number
}

/**
 * Framework-agnostic cache service using Redis.
 * Can be used standalone or wrapped in NestJS providers.
 */
export class CacheService {
	private redis: Redis
	private keyPrefix: string
	private defaultTTL: number
	private logger?: Logger

	constructor(options: CacheOptions = {}) {
		const {
			redisUrl = 'redis://localhost:6379',
			redisPassword,
			redisTls = false,
			keyPrefix = 'exprealty',
			defaultTTL = 3600, // 1 hour
			logger,
			onError,
		} = options

		this.keyPrefix = keyPrefix
		this.defaultTTL = defaultTTL
		this.logger = logger

		// Parse Redis URL
		const url = new URL(redisUrl)

		const redisOptions: RedisOptions = {
			host: url.hostname,
			port: parseInt(url.port || '6379', 10),
			password: redisPassword || url.password || undefined,
			db: url.pathname ? parseInt(url.pathname.slice(1), 10) : 0,
			//lazyConnect: true, // Don't connect in constructor; wait for explicit connect/waitForReady
			lazyConnect: false, // Connect immediately to avoid race conditions
			retryStrategy: (times) => {
				const delay = Math.min(times * 50, 2000)
				this.logger?.info(`Redis retry attempt ${times}, waiting ${delay}ms`)
				return delay
			},
			maxRetriesPerRequest: 3,
			connectTimeout: 10000, // 10 second connection timeout
		}

		// ADD EXTENSIVE LOGGING HERE
		console.log('[CACHE-DEBUG] redisTls parameter:', redisTls)
		console.log('[CACHE-DEBUG] typeof redisTls:', typeof redisTls)
		console.log('[CACHE-DEBUG] redisTls is truthy:', redisTls)

		if (redisTls) {
			console.log('[CACHE-DEBUG] TLS IS BEING ENABLED!')
			redisOptions.tls = {
				rejectUnauthorized: false,
			}
		} else {
			console.log('[CACHE-DEBUG] TLS is NOT being enabled')
		}

		console.log(
			'[CACHE-DEBUG] Final redisOptions:',
			JSON.stringify(redisOptions, null, 2),
		)

		this.redis = new Redis(redisOptions)

		// Error handling
		this.redis.on('error', (error) => {
			this.logger?.error('Redis connection error', { error: error.message })
			onError?.(error)
		})

		this.redis.on('connect', () => {
			this.logger?.info('Redis connected successfully')
		})

		this.redis.on('ready', () => {
			this.logger?.info('Redis ready to accept commands')
		})
	}

	/**
	 * Build a namespaced cache key
	 */
	private buildKey(key: string): string {
		return `${this.keyPrefix}:${key}`
	}

	/**
	 * Get a value from cache
	 */
	async get<T = unknown>(key: string): Promise<T | null> {
		try {
			const fullKey = this.buildKey(key)
			const value = await this.redis.get(fullKey)

			if (value === null) {
				this.logger?.debug(`Cache miss: ${key}`)
				return null
			}

			this.logger?.debug(`Cache hit: ${key}`)
			return JSON.parse(value) as T
		} catch (error) {
			this.logger?.error(`Cache get error for key: ${key}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	}

	/**
	 * Set a value in cache with optional TTL
	 */
	async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
		try {
			const fullKey = this.buildKey(key)
			const serialized = JSON.stringify(value)
			const ttl = ttlSeconds ?? this.defaultTTL

			if (ttl > 0) {
				await this.redis.setex(fullKey, ttl, serialized)
			} else {
				await this.redis.set(fullKey, serialized)
			}

			this.logger?.debug(`Cache set: ${key} (TTL: ${ttl}s)`)
		} catch (error) {
			this.logger?.error(`Cache set error for key: ${key}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Delete a key from cache
	 */
	async del(key: string | string[]): Promise<number> {
		try {
			const keys = Array.isArray(key) ? key : [key]
			const fullKeys = keys.map((k) => this.buildKey(k))
			const deleted = await this.redis.del(...fullKeys)

			this.logger?.debug(`Cache deleted: ${keys.join(', ')} (${deleted} keys)`)
			return deleted
		} catch (error) {
			this.logger?.error(`Cache delete error`, {
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Check if a key exists
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const fullKey = this.buildKey(key)
			const exists = await this.redis.exists(fullKey)
			return exists === 1
		} catch (error) {
			this.logger?.error(`Cache exists error for key: ${key}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			return false
		}
	}

	/**
	 * Get remaining TTL for a key (in seconds)
	 */
	async ttl(key: string): Promise<number> {
		try {
			const fullKey = this.buildKey(key)
			return await this.redis.ttl(fullKey)
		} catch (error) {
			this.logger?.error(`Cache TTL error for key: ${key}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			return -2 // Key doesn't exist
		}
	}

	/**
	 * Set expiration time for an existing key
	 */
	async expire(key: string, ttlSeconds: number): Promise<boolean> {
		try {
			const fullKey = this.buildKey(key)
			const result = await this.redis.expire(fullKey, ttlSeconds)
			return result === 1
		} catch (error) {
			this.logger?.error(`Cache expire error for key: ${key}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			return false
		}
	}

	/**
	 * Delete all keys matching a pattern
	 */
	async delPattern(pattern: string): Promise<number> {
		try {
			const fullPattern = this.buildKey(pattern)
			const keys = await this.redis.keys(fullPattern)

			if (keys.length === 0) {
				return 0
			}

			const deleted = await this.redis.del(...keys)
			this.logger?.debug(`Cache deleted pattern: ${pattern} (${deleted} keys)`)
			return deleted
		} catch (error) {
			this.logger?.error(`Cache delete pattern error: ${pattern}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Flush all keys in the current database
	 */
	async flushAll(): Promise<void> {
		try {
			await this.redis.flushdb()
			this.logger?.warn('Cache flushed all keys')
		} catch (error) {
			this.logger?.error(`Cache flush error`, {
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Get or set pattern - fetch from cache or compute and cache
	 */
	async getOrSet<T = unknown>(
		key: string,
		factory: () => Promise<T>,
		ttlSeconds?: number,
	): Promise<T> {
		const cached = await this.get<T>(key)

		if (cached !== null) {
			return cached
		}

		const value = await factory()
		await this.set(key, value, ttlSeconds)
		return value
	}

	/**
	 * Increment a numeric value
	 */
	async incr(key: string, by = 1): Promise<number> {
		try {
			const fullKey = this.buildKey(key)
			const result = await this.redis.incrby(fullKey, by)
			return result
		} catch (error) {
			this.logger?.error(`Cache incr error for key: ${key}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Decrement a numeric value
	 */
	async decr(key: string, by = 1): Promise<number> {
		try {
			const fullKey = this.buildKey(key)
			const result = await this.redis.decrby(fullKey, by)
			return result
		} catch (error) {
			this.logger?.error(`Cache decr error for key: ${key}`, {
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Get cache statistics
	 */
	async getStats(): Promise<{
		keys: number
		memory: string
		uptime: number
		connected: boolean
	}> {
		try {
			const info = await this.redis.info('stats')
			const keyspace = await this.redis.info('keyspace')
			const memory = await this.redis.info('memory')

			// Parse keyspace to get key count
			const dbMatch = keyspace.match(/keys=(\d+)/)
			const keys = dbMatch ? parseInt(dbMatch[1], 10) : 0

			// Parse memory usage
			const memMatch = memory.match(/used_memory_human:(.+)/)
			const usedMemory = memMatch ? memMatch[1].trim() : 'unknown'

			// Parse uptime
			const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/)
			const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0

			return {
				keys,
				memory: usedMemory,
				uptime,
				connected: this.redis.status === 'ready',
			}
		} catch (error) {
			this.logger?.error(`Cache stats error`, {
				error: error instanceof Error ? error.message : String(error),
			})
			return {
				keys: 0,
				memory: 'unknown',
				uptime: 0,
				connected: false,
			}
		}
	}

	/**
	 * Wait for Redis connection to be ready
	 */
	async waitForReady(timeoutMs = 5000): Promise<void> {
		return new Promise((resolve, reject) => {
			this.logger?.info(
				`Waiting for Redis connection (current status: ${this.redis.status})`,
			)

			const timeout = setTimeout(() => {
				this.redis.off('ready', onReady)
				this.redis.off('error', onError)
				this.logger?.error(
					`Redis connection timeout after ${timeoutMs}ms (final status: ${this.redis.status})`,
				)
				reject(
					new Error(
						`Redis connection timeout after ${timeoutMs}ms (status: ${this.redis.status})`,
					),
				)
			}, timeoutMs)

			if (this.redis.status === 'ready') {
				clearTimeout(timeout)
				this.logger?.info('Redis already ready')
				resolve()
				return
			}

			const onReady = () => {
				clearTimeout(timeout)
				this.redis.off('error', onError)
				this.logger?.info('Redis ready event received')
				resolve()
			}

			const onError = (error: Error) => {
				clearTimeout(timeout)
				this.redis.off('ready', onReady)
				this.logger?.error(`Redis connection error: ${error.message}`)
				reject(error)
			}

			this.redis.once('ready', onReady)
			this.redis.once('error', onError)

			// With lazyConnect: false, connection is already initiated in constructor
			// So we just wait for ready or error events
		})
	}

	/**
	 * Health check - verify Redis connection
	 */
	async healthCheck(): Promise<boolean> {
		try {
			// Check if client is ready first
			if (this.redis.status !== 'ready') {
				this.logger?.warn(`Cache health check: Redis status is ${this.redis.status}`)
				return false
			}

			// Use Promise.race to add timeout to ping
			const pingPromise = this.redis.ping()
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error('Health check timeout'))
				}, 2000)
			})

			await Promise.race([pingPromise, timeoutPromise])
			return true
		} catch (error) {
			this.logger?.error(`Cache health check failed`, {
				error: error instanceof Error ? error.message : String(error),
				status: this.redis.status,
			})
			return false
		}
	}

	/**
	 * Close Redis connection
	 */
	async disconnect(): Promise<void> {
		try {
			await this.redis.quit()
			this.logger?.info('Redis disconnected')
		} catch (error) {
			this.logger?.error(`Redis disconnect error`, {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	/**
	 * Get the underlying Redis client (for advanced operations)
	 */
	getClient(): Redis {
		return this.redis
	}
}

/**
 * Create a cache service instance
 */
export function createCache(options?: CacheOptions): CacheService {
	return new CacheService(options)
}

// Export types
export type Cache = CacheService
