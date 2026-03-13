import { CountCacheService, CountResult, CountCacheConfig } from './count-cache.service.js'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockCacheService() {
	return {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue(undefined),
		del: jest.fn().mockResolvedValue(1),
		delPattern: jest.fn().mockResolvedValue(0),
		getStats: jest.fn().mockResolvedValue({
			keys: 0,
			memory: '0B',
			uptime: 100,
			connected: true,
		}),
		healthCheck: jest.fn().mockResolvedValue(true),
	}
}

function createMockDataSource() {
	return {
		query: jest.fn().mockResolvedValue([]),
	}
}

function createMockLogger() {
	return {
		createScopedLogger: jest.fn().mockReturnValue({
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		}),
	}
}

/** Creates a mock SelectQueryBuilder with getQueryAndParameters for EXPLAIN tests */
function createExplainMockQb(overrides?: {
	sql?: string
	paramValues?: any[]
	getCountResult?: number | Promise<number>
}) {
	const sqlAndParams: [string, any[]] = [
		overrides?.sql ?? 'SELECT COUNT(*) FROM agent',
		overrides?.paramValues ?? [],
	]
	const self: any = {
		select: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		take: jest.fn().mockReturnThis(),
		offset: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		getQueryAndParameters: jest.fn().mockReturnValue(sqlAndParams),
		getCount: jest.fn().mockResolvedValue(overrides?.getCountResult ?? 0),
		clone: jest.fn(),
	}
	// By default, clone returns a new object that also chains
	self.clone.mockImplementation(() => {
		const cloned: any = {
			select: jest.fn().mockReturnThis(),
			skip: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			offset: jest.fn().mockReturnThis(),
			limit: jest.fn().mockReturnThis(),
			getQueryAndParameters: jest.fn().mockReturnValue(sqlAndParams),
			getCount: jest.fn().mockResolvedValue(overrides?.getCountResult ?? 0),
			clone: jest.fn(),
		}
		return cloned
	})
	return self
}

function buildService(overrides?: {
	cache?: ReturnType<typeof createMockCacheService>
	dataSource?: ReturnType<typeof createMockDataSource>
	config?: Partial<CountCacheConfig>
}) {
	const cache = overrides?.cache ?? createMockCacheService()
	const dataSource = overrides?.dataSource ?? createMockDataSource()
	const logger = createMockLogger()
	const config = overrides?.config ?? {}

	const service = new CountCacheService(
		cache as any,
		dataSource as any,
		logger as any,
		config,
	)

	return { service, cache, dataSource, logger }
}

/** Flush setImmediate callbacks */
function flushImmediate(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CountCacheService', () => {

	afterEach(() => {
		jest.restoreAllMocks()
	})

	// -----------------------------------------------------------------------
	// buildCacheKey
	// -----------------------------------------------------------------------

	describe('buildCacheKey', () => {
		it('should produce deterministic keys for same entity + filters', () => {
			const { service } = buildService()
			const key1 = service.buildCacheKey('agent', { status: 'Active', city: 'Dallas' })
			const key2 = service.buildCacheKey('agent', { status: 'Active', city: 'Dallas' })
			expect(key1).toBe(key2)
		})

		it('should produce same key regardless of filter property order', () => {
			const { service } = buildService()
			const key1 = service.buildCacheKey('agent', { city: 'Dallas', status: 'Active' })
			const key2 = service.buildCacheKey('agent', { status: 'Active', city: 'Dallas' })
			expect(key1).toBe(key2)
		})

		it('should produce different keys for different entities', () => {
			const { service } = buildService()
			const key1 = service.buildCacheKey('agent', { status: 'Active' })
			const key2 = service.buildCacheKey('office', { status: 'Active' })
			expect(key1).not.toBe(key2)
		})

		it('should produce different keys for different filters', () => {
			const { service } = buildService()
			const key1 = service.buildCacheKey('agent', { status: 'Active' })
			const key2 = service.buildCacheKey('agent', { status: 'InActive' })
			expect(key1).not.toBe(key2)
		})

		it('should strip null and undefined filter values', () => {
			const { service } = buildService()
			const key1 = service.buildCacheKey('agent', { status: 'Active' })
			const key2 = service.buildCacheKey('agent', { status: 'Active', city: null, state: undefined })
			expect(key1).toBe(key2)
		})

		it('should start with count:<entityName>:<16-char hex>', () => {
			const { service } = buildService()
			const key = service.buildCacheKey('agent', {})
			expect(key).toMatch(/^count:agent:[a-f0-9]{16}$/)
		})
	})

	// -----------------------------------------------------------------------
	// getCount — L1 LRU hit
	// -----------------------------------------------------------------------

	describe('getCount — L1 LRU hit', () => {
		it('should return cached result from LRU on second call', async () => {
			const { service, cache, dataSource } = buildService()

			// First call — no filters → pg_class
			dataSource.query.mockResolvedValueOnce([{ estimate: '5000' }])
			const first = await service.getCount('agent', 'core', {})
			expect(first).toEqual({ count: 5000, isApproximate: true, source: 'pg_stats' })
			expect(dataSource.query).toHaveBeenCalledTimes(1)

			// Second call — should hit L1 LRU, no DB or Redis call
			const second = await service.getCount('agent', 'core', {})
			expect(second).toEqual(first)
			expect(dataSource.query).toHaveBeenCalledTimes(1) // no additional DB call
			expect(cache.get).toHaveBeenCalledTimes(1) // only from first call
		})
	})

	// -----------------------------------------------------------------------
	// getCount — L2 Redis hit
	// -----------------------------------------------------------------------

	describe('getCount — L2 Redis hit', () => {
		it('should return result from Redis and backfill LRU', async () => {
			const { service, cache, dataSource } = buildService()

			const redisResult: CountResult = { count: 1234, isApproximate: false, source: 'exact' }
			cache.get.mockResolvedValueOnce(redisResult)

			const result = await service.getCount('agent', 'core', { search: 'John' })
			expect(result).toEqual(redisResult)
			expect(dataSource.query).not.toHaveBeenCalled()

			// Second call should hit L1 now (backfilled from Redis)
			const second = await service.getCount('agent', 'core', { search: 'John' })
			expect(second).toEqual(redisResult)
			// cache.get only called once — second call hit LRU
			expect(cache.get).toHaveBeenCalledTimes(1)
		})
	})

	// -----------------------------------------------------------------------
	// getCount — L3a: no filters → pg_class estimate
	// -----------------------------------------------------------------------

	describe('getCount — no filters (pg_class)', () => {
		it('should query pg_class with entity name and schema', async () => {
			const { service, dataSource } = buildService()
			dataSource.query.mockResolvedValueOnce([{ estimate: '267000' }])

			const result = await service.getCount('agent', 'core', {})
			expect(result).toEqual({ count: 267000, isApproximate: true, source: 'pg_stats' })

			expect(dataSource.query).toHaveBeenCalledWith(
				expect.stringContaining('pg_class'),
				['agent', 'core'],
			)
		})

		it('should store in both L1 and L2 with unfilteredTtl', async () => {
			const { service, cache, dataSource } = buildService()
			dataSource.query.mockResolvedValueOnce([{ estimate: '100' }])

			await service.getCount('agent', 'core', {})
			expect(cache.set).toHaveBeenCalledWith(
				expect.stringMatching(/^count:agent:/),
				{ count: 100, isApproximate: true, source: 'pg_stats' },
				60, // DEFAULT unfilteredTtl
			)
		})

		it('should return 0 when pg_class query fails', async () => {
			const { service, dataSource } = buildService()
			dataSource.query.mockRejectedValueOnce(new Error('connection lost'))

			const result = await service.getCount('agent', 'core', {})
			expect(result.count).toBe(0)
		})

		it('should return 0 when pg_class returns empty result set', async () => {
			const { service, dataSource } = buildService()
			dataSource.query.mockResolvedValueOnce([])

			const result = await service.getCount('agent', 'core', {})
			expect(result.count).toBe(0)
		})
	})

	// -----------------------------------------------------------------------
	// getCount — L3b: with filters → EXPLAIN estimate + background exact
	// -----------------------------------------------------------------------

	describe('getCount — with filters (EXPLAIN estimate)', () => {
		it('should run EXPLAIN on cloned QB and return approximate result', async () => {
			const { service, dataSource } = buildService()

			const mockQb = createExplainMockQb({ getCountResult: 5100 })

			// EXPLAIN result
			dataSource.query.mockResolvedValueOnce([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 5054 } }],
			}])

			const result = await service.getCount('agent', 'core', { search: 'John' }, { queryBuilder: mockQb })

			expect(result).toEqual({ count: 5054, isApproximate: true, source: 'explain' })
			expect(dataSource.query).toHaveBeenCalledWith(
				expect.stringContaining('EXPLAIN'),
				expect.any(Array),
			)
		})

		it('should fall back to pg_class when no context provided', async () => {
			const { service, dataSource } = buildService()
			dataSource.query.mockResolvedValueOnce([{ estimate: '267000' }])

			const result = await service.getCount('agent', 'core', { search: 'John' })
			expect(result).toEqual({ count: 267000, isApproximate: true, source: 'explain' })
			expect(dataSource.query).toHaveBeenCalledWith(
				expect.stringContaining('pg_class'),
				['agent', 'core'],
			)
		})

		it('should return 0 when EXPLAIN fails', async () => {
			const { service, dataSource } = buildService()
			const mockQb = createExplainMockQb()

			dataSource.query.mockRejectedValueOnce(new Error('EXPLAIN failed'))

			const result = await service.getCount('agent', 'core', { search: 'x' }, { queryBuilder: mockQb })
			expect(result.count).toBe(0)
			expect(result.isApproximate).toBe(true)
			expect(result.source).toBe('explain')
		})

		it('should store approximate result with approximateTtl', async () => {
			const { service, cache, dataSource } = buildService()
			const mockQb = createExplainMockQb()

			dataSource.query.mockResolvedValueOnce([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 100 } }],
			}])

			await service.getCount('agent', 'core', { search: 'test' }, { queryBuilder: mockQb })

			expect(cache.set).toHaveBeenCalledWith(
				expect.stringMatching(/^count:agent:/),
				{ count: 100, isApproximate: true, source: 'explain' },
				15, // DEFAULT approximateTtl
			)
		})
	})

	// -----------------------------------------------------------------------
	// Background exact count
	// -----------------------------------------------------------------------

	describe('background exact count', () => {
		it('should fire background job that overwrites with exact count', async () => {
			const { service, cache, dataSource } = buildService()

			const mockQb = createExplainMockQb({ getCountResult: 5100 })

			// EXPLAIN result
			dataSource.query.mockResolvedValueOnce([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 5000 } }],
			}])

			await service.getCount('agent', 'core', { search: 'John' }, { queryBuilder: mockQb })

			// Wait for setImmediate + async callback
			await flushImmediate()
			await new Promise((r) => setTimeout(r, 10))

			// Background job should have stored exact result with exactTtl
			expect(cache.set).toHaveBeenCalledWith(
				expect.stringMatching(/^count:agent:/),
				{ count: 5100, isApproximate: false, source: 'exact' },
				300, // DEFAULT exactTtl
			)
		})

		it('should clone the QB for background count (no shared mutation)', async () => {
			const { service, dataSource } = buildService()

			const mockQb = createExplainMockQb({ getCountResult: 42 })

			dataSource.query.mockResolvedValueOnce([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 40 } }],
			}])

			await service.getCount('agent', 'core', { search: 'a' }, { queryBuilder: mockQb })

			await flushImmediate()
			await new Promise((r) => setTimeout(r, 10))

			// clone() should have been called: once for EXPLAIN, once for background getCount
			expect(mockQb.clone).toHaveBeenCalledTimes(2)
		})

		it('should not queue duplicate background job for same key', async () => {
			const { service, cache, dataSource } = buildService()

			// QB that never resolves getCount (simulates in-flight)
			const mockQb = createExplainMockQb()
			mockQb.clone.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				offset: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				getQueryAndParameters: jest.fn().mockReturnValue(['SELECT ...', []]),
				getCount: jest.fn().mockReturnValue(new Promise(() => {})), // never resolves
				clone: jest.fn(),
			}))

			dataSource.query.mockResolvedValue([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 100 } }],
			}])

			await service.getCount('agent', 'core', { search: 'a' }, { queryBuilder: mockQb })
			await flushImmediate()

			const stats1 = await service.getStats()
			expect(stats1.pendingJobs).toBe(1)

			// Clear LRU so second call reaches queueExactCount path
			await service.invalidate('agent')

			await service.getCount('agent', 'core', { search: 'a' }, { queryBuilder: mockQb })
			await flushImmediate()

			const stats2 = await service.getStats()
			expect(stats2.pendingJobs).toBe(1) // still just 1
		})

		it('should respect maxConcurrentBackgroundCounts limit', async () => {
			const { service, dataSource } = buildService({
				config: { maxConcurrentBackgroundCounts: 2 },
			})

			const makeNeverResolveQb = () => {
				const qb = createExplainMockQb()
				qb.clone.mockImplementation(() => ({
					select: jest.fn().mockReturnThis(),
					skip: jest.fn().mockReturnThis(),
					take: jest.fn().mockReturnThis(),
					offset: jest.fn().mockReturnThis(),
					limit: jest.fn().mockReturnThis(),
					getQuery: jest.fn().mockReturnValue('SELECT ...'),
					getParameters: jest.fn().mockReturnValue({}),
					getCount: jest.fn().mockReturnValue(new Promise(() => {})),
					clone: jest.fn(),
				}))
				return qb
			}

			dataSource.query.mockResolvedValue([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 1 } }],
			}])

			// Queue 3 jobs (limit is 2)
			await service.getCount('agent', 'core', { s: '1' }, { queryBuilder: makeNeverResolveQb() })
			await service.getCount('agent', 'core', { s: '2' }, { queryBuilder: makeNeverResolveQb() })
			await service.getCount('agent', 'core', { s: '3' }, { queryBuilder: makeNeverResolveQb() })
			await flushImmediate()

			const stats = await service.getStats()
			expect(stats.activeBackgroundCounts).toBe(2) // capped at 2
		})

		it('should decrement activeBackgroundCounts when job fails', async () => {
			const { service, dataSource } = buildService()

			const mockQb = createExplainMockQb()
			mockQb.clone.mockImplementation(() => {
				const cloned: any = {
					select: jest.fn().mockReturnThis(),
					skip: jest.fn().mockReturnThis(),
					take: jest.fn().mockReturnThis(),
					offset: jest.fn().mockReturnThis(),
					limit: jest.fn().mockReturnThis(),
					getQuery: jest.fn().mockReturnValue('SELECT ...'),
					getParameters: jest.fn().mockReturnValue({}),
					getCount: jest.fn().mockRejectedValue(new Error('DB down')),
					clone: jest.fn(),
				}
				return cloned
			})

			dataSource.query.mockResolvedValueOnce([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 10 } }],
			}])

			await service.getCount('agent', 'core', { search: 'fail' }, { queryBuilder: mockQb })
			await flushImmediate()
			await new Promise((r) => setTimeout(r, 10))

			const stats = await service.getStats()
			expect(stats.activeBackgroundCounts).toBe(0)
			expect(stats.pendingJobs).toBe(0)
		})
	})

	// -----------------------------------------------------------------------
	// LRU eviction and expiry
	// -----------------------------------------------------------------------

	describe('LRU behavior', () => {
		it('should evict oldest entry when LRU is at capacity', async () => {
			const { service, dataSource } = buildService({
				config: { lruMaxSize: 2 },
			})

			dataSource.query.mockResolvedValue([{ estimate: '100' }])

			await service.getCount('entity_a', 'core', {})
			await service.getCount('entity_b', 'core', {})
			await service.getCount('entity_c', 'core', {})

			const stats = await service.getStats()
			expect(stats.lruSize).toBe(2)
		})

		it('should expire LRU entries after lruTtlMs', async () => {
			jest.useFakeTimers()
			try {
				const { service, cache, dataSource } = buildService({
					config: { lruTtlMs: 1000 },
				})

				dataSource.query.mockResolvedValue([{ estimate: '100' }])
				cache.get.mockResolvedValue(null)

				await service.getCount('agent', 'core', {})
				expect(dataSource.query).toHaveBeenCalledTimes(1)

				// Advance past LRU TTL
				jest.advanceTimersByTime(1500)

				// Next call should miss LRU (expired), miss Redis, hit pg_class again
				dataSource.query.mockResolvedValueOnce([{ estimate: '101' }])
				const result = await service.getCount('agent', 'core', {})
				expect(result.count).toBe(101)
				expect(dataSource.query).toHaveBeenCalledTimes(2)
			} finally {
				jest.useRealTimers()
			}
		})
	})

	// -----------------------------------------------------------------------
	// invalidate
	// -----------------------------------------------------------------------

	describe('invalidate', () => {
		it('should clear L1 entries matching entity and call delPattern on L2', async () => {
			const { service, cache, dataSource } = buildService()
			dataSource.query.mockResolvedValue([{ estimate: '100' }])

			await service.getCount('agent', 'core', {})
			await service.getCount('agent', 'core', { search: 'x' })
			expect((await service.getStats()).lruSize).toBe(2)

			cache.delPattern.mockResolvedValueOnce(5)
			await service.invalidate('agent')

			expect((await service.getStats()).lruSize).toBe(0)
			expect(cache.delPattern).toHaveBeenCalledWith('count:agent:*')
		})

		it('should not clear entries for other entities', async () => {
			const { service, dataSource } = buildService()
			dataSource.query.mockResolvedValue([{ estimate: '100' }])

			await service.getCount('agent', 'core', {})
			await service.getCount('office', 'core', {})
			expect((await service.getStats()).lruSize).toBe(2)

			await service.invalidate('agent')
			expect((await service.getStats()).lruSize).toBe(1) // office remains
		})
	})

	// -----------------------------------------------------------------------
	// isHealthy / getStats
	// -----------------------------------------------------------------------

	describe('isHealthy', () => {
		it('should delegate to CacheService.healthCheck', async () => {
			const { service, cache } = buildService()
			cache.healthCheck.mockResolvedValueOnce(true)
			expect(await service.isHealthy()).toBe(true)

			cache.healthCheck.mockResolvedValueOnce(false)
			expect(await service.isHealthy()).toBe(false)
		})
	})

	describe('getStats', () => {
		it('should return lruSize, pendingJobs, activeBackgroundCounts, and redis stats', async () => {
			const { service } = buildService()
			const stats = await service.getStats()
			expect(stats).toEqual({
				lruSize: 0,
				pendingJobs: 0,
				activeBackgroundCounts: 0,
				redis: { keys: 0, memory: '0B', uptime: 100, connected: true },
			})
		})
	})

	// -----------------------------------------------------------------------
	// onModuleDestroy
	// -----------------------------------------------------------------------

	describe('onModuleDestroy', () => {
		it('should clear LRU and pendingJobs', async () => {
			const { service, dataSource } = buildService()
			dataSource.query.mockResolvedValue([{ estimate: '100' }])
			await service.getCount('agent', 'core', {})

			expect((await service.getStats()).lruSize).toBe(1)
			await service.onModuleDestroy()
			expect((await service.getStats()).lruSize).toBe(0)
		})
	})

	// -----------------------------------------------------------------------
	// Config overrides
	// -----------------------------------------------------------------------

	describe('config overrides', () => {
		it('should merge partial config with defaults', async () => {
			const { service, cache, dataSource } = buildService({
				config: { unfilteredTtl: 120 },
			})

			dataSource.query.mockResolvedValueOnce([{ estimate: '100' }])
			await service.getCount('agent', 'core', {})

			expect(cache.set).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Object),
				120, // overridden TTL
			)
		})
	})

	// -----------------------------------------------------------------------
	// EXPLAIN parameter ordering
	// -----------------------------------------------------------------------

	describe('EXPLAIN parameter passing', () => {
		it('should pass parameters from getQueryAndParameters to EXPLAIN query', async () => {
			const { service, dataSource } = buildService()

			const mockQb = createExplainMockQb({
				sql: 'SELECT COUNT(*) FROM agent WHERE a = $1 AND b = $2 AND c = $3',
				paramValues: ['first', 'second', 'third'],
			})

			dataSource.query.mockResolvedValueOnce([{
				'QUERY PLAN': [{ Plan: { 'Plan Rows': 42 } }],
			}])

			await service.getCount('agent', 'core', { f: '1' }, { queryBuilder: mockQb })

			expect(dataSource.query).toHaveBeenCalledWith(
				expect.stringContaining('EXPLAIN'),
				['first', 'second', 'third'],
			)
		})
	})
})
