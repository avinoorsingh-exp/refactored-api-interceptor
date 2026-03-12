import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { createHash } from 'crypto'
import { DataSource, SelectQueryBuilder } from 'typeorm'
import { CacheService } from '@exprealty/cache'
import { LoggerService, ScopedLogger } from '../../core/logger.service.js'

/**
 * Shape returned to callers — includes whether the number is exact or estimated
 * so the API response meta can expose this to clients (e.g. "~14,200 results").
 */
export interface CountResult {
  count: number
  isApproximate: boolean
  source: 'lru' | 'redis' | 'pg_stats' | 'explain' | 'exact'
}

/**
 * Controls TTLs and behaviour per scenario.
 * Override at instantiation if defaults need tuning per service.
 */
export interface CountCacheConfig {
  /** TTL for unfiltered pg_class estimates (seconds) */
  unfilteredTtl: number
  /** TTL for the fast approximate placed while the background exact count runs */
  approximateTtl: number
  /** TTL for exact filtered counts once the background job completes */
  exactTtl: number
  /** In-process LRU: max entries kept per service instance */
  lruMaxSize: number
  /** In-process LRU: TTL in milliseconds */
  lruTtlMs: number
  /** Max concurrent background exact-count queries to prevent pool exhaustion */
  maxConcurrentBackgroundCounts: number
}

const DEFAULT_CONFIG: CountCacheConfig = {
  unfilteredTtl: 60,       // pg_class stats refresh after ANALYZE — 60s is plenty
  approximateTtl: 15,      // short window so real count overwrites quickly
  exactTtl: 300,           // 5 min — aligned with your 15-min Airflow ingestion cadence
  lruMaxSize: 100,
  lruTtlMs: 30_000,        // 30 seconds
  maxConcurrentBackgroundCounts: 3,
}

interface LruEntry {
  result: CountResult
  expiresAt: number
}

/**
 * Query builder info needed for EXPLAIN estimate and exact count.
 * Callers pass the raw QB so we can extract SQL for EXPLAIN and run getCount().
 */
export interface CountQueryContext {
  /** The configured SelectQueryBuilder (with all WHERE/JOIN applied, before pagination) */
  queryBuilder: SelectQueryBuilder<any>
}

@Injectable()
export class CountCacheService implements OnModuleDestroy {
  private readonly logger: ScopedLogger;
  private readonly resolvedConfig: CountCacheConfig;

  /**
   * Layer 1 — in-process LRU.
   * Simple Map-based LRU: cheap, no dependencies, sub-millisecond.
   * Scoped to this service instance — each ECS task maintains its own.
   */
  private readonly lru = new Map<string, LruEntry>()

  /** Tracks which cache keys have a background exact-count job in flight */
  private readonly pendingJobs = new Set<string>()

  /** Current number of active background count queries */
  private activeBackgroundCounts = 0

  constructor(
    private readonly cache: CacheService,
    private readonly dataSource: DataSource,
    private readonly loggerService: LoggerService,
    config: Partial<CountCacheConfig> = {},
  ) {
    this.resolvedConfig = { ...DEFAULT_CONFIG, ...config }
    this.logger = loggerService.createScopedLogger('CountCacheService')
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Primary entry point.
   *
   * Strategy:
   *   1. L1 LRU hit  → return immediately
   *   2. L2 Redis hit → backfill L1, return
   *   3. No filters   → pg_class estimate (instant), store both layers
   *   4. With filters → EXPLAIN row estimate returned immediately,
   *                     exact count queued as fire-and-forget background job
   *
   * @param entityName  Postgres table name, e.g. 'agent'
   * @param schema      Postgres schema name, e.g. 'core'
   * @param filters     Raw filter + search params from query (used for cache key)
   * @param context     Optional — a pre-configured TypeORM QB for EXPLAIN/exact count
   */
  async getCount(
    entityName: string,
    schema: string,
    filters: Record<string, unknown>,
    context?: CountQueryContext,
  ): Promise<CountResult> {
    const key = this.buildCacheKey(entityName, filters)
    const hasFilters = Object.keys(filters).length > 0

    // --- L1: in-process LRU ---
    const l1 = this.getLru(key)
    if (l1) {
      this.logger.debug(`Count cache L1 hit: ${key}`)
      return l1
    }

    // --- L2: Redis (shared across instances) ---
    const l2 = await this.cache.get<CountResult>(key)
    if (l2) {
      this.logger.debug(`Count cache L2 hit: ${key}`)
      this.setLru(key, l2)
      return l2
    }

    // --- L3a: no filters → pg_class statistics ---
    if (!hasFilters) {
      const count = await this.getPgClassEstimate(entityName, schema)
      const result: CountResult = { count, isApproximate: true, source: 'pg_stats' }
      await this.store(key, result, this.resolvedConfig.unfilteredTtl)
      return result
    }

    // --- L3b: with filters → EXPLAIN estimate now, exact count async ---
    const approximate = context
      ? await this.getExplainEstimate(context.queryBuilder)
      : await this.getPgClassEstimate(entityName, schema) // fallback if no QB provided

    const approximateResult: CountResult = {
      count: approximate,
      isApproximate: true,
      source: 'explain',
    }

    // Store the approximate immediately so the next request hits L1/L2
    await this.store(key, approximateResult, this.resolvedConfig.approximateTtl)

    // Fire exact count in background — overwrites approximate when done
    if (context && !this.pendingJobs.has(key)) {
      this.queueExactCount(key, context.queryBuilder)
    }

    return approximateResult
  }

  /**
   * Invalidate all count cache entries for a given entity.
   * Call this from write operations (create/update/delete) or ingestion handlers.
   *
   * @example
   *   await countCacheService.invalidate('agent')
   */
  async invalidate(entityName: string): Promise<void> {
    // Clear L1 entries that match (keys have no CacheService prefix — that's added by CacheService internally)
    const l1Prefix = `count:${entityName}:`
    for (const key of this.lru.keys()) {
      if (key.startsWith(l1Prefix)) {
        this.lru.delete(key)
      }
    }

    // Clear L2 via Redis key pattern — CacheService.delPattern adds its own prefix
    const pattern = `count:${entityName}:*`
    const deleted = await this.cache.delPattern(pattern)
    this.logger.info(`Count cache invalidated for ${entityName} — ${deleted} Redis keys removed`)
  }

  /**
   * Health check — delegates to your CacheService.
   */
  async isHealthy(): Promise<boolean> {
    return this.cache.healthCheck()
  }

  /**
   * Diagnostic stats — useful for your /health or /metrics endpoints.
   */
  async getStats(): Promise<{
    lruSize: number
    pendingJobs: number
    activeBackgroundCounts: number
    redis: Awaited<ReturnType<CacheService['getStats']>>
  }> {
    return {
      lruSize: this.lru.size,
      pendingJobs: this.pendingJobs.size,
      activeBackgroundCounts: this.activeBackgroundCounts,
      redis: await this.cache.getStats(),
    }
  }

  // ---------------------------------------------------------------------------
  // Cache key — no prefix here; CacheService.buildKey() adds its own keyPrefix
  // ---------------------------------------------------------------------------

  /**
   * Deterministic, collision-resistant cache key.
   * Filters are sorted before hashing so { city: 'Dallas', status: 'Active' }
   * and { status: 'Active', city: 'Dallas' } resolve to the same key.
   *
   * Does NOT include a keyPrefix — CacheService.buildKey() handles that internally
   * to avoid double-prefixing (e.g. exprealty:agentdb:exprealty:agentdb:...).
   */
  buildCacheKey(entityName: string, filters: Record<string, unknown>): string {
    const normalizedFilters = Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null)
        .sort(([a], [b]) => a.localeCompare(b)),
    )

    const hash = createHash('sha256')
      .update(`${entityName}:${JSON.stringify(normalizedFilters)}`)
      .digest('hex')
      .slice(0, 16)

    return `count:${entityName}:${hash}`
  }

  // ---------------------------------------------------------------------------
  // Count sources
  // ---------------------------------------------------------------------------

  /**
   * PostgreSQL planner statistics — essentially free, ~5–10ms.
   * Only accurate for unfiltered full-table counts.
   * Statistics are updated after ANALYZE / autovacuum.
   * Filters by schema to avoid collisions with identically-named tables in other schemas.
   */
  private async getPgClassEstimate(entityName: string, schema: string): Promise<number> {
    try {
      const result = await this.dataSource.query(
        `SELECT c.reltuples::bigint AS estimate
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relname = $1 AND n.nspname = $2`,
        [entityName, schema],
      )
      return parseInt(result[0]?.estimate ?? '0', 10)
    } catch (error) {
      this.logger.error('pg_class estimate failed', {
        entityName,
        schema,
        error: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  /**
   * PostgreSQL EXPLAIN (no execution) row estimate.
   * Typically within 10–20% accuracy on filtered queries.
   * Non-blocking — query planner runs in microseconds.
   *
   * Unlike QueryPerformanceInterceptor's EXPLAIN ANALYZE (which re-executes
   * the query for diagnostics), this runs EXPLAIN without ANALYZE — zero I/O,
   * purely the planner's estimate. Different purpose: optimization vs observability.
   */
  private async getExplainEstimate(
    qb: SelectQueryBuilder<any>,
  ): Promise<number> {
    try {
      // Clone to avoid mutating the original QB, then build a COUNT query
      // Use undefined to remove LIMIT/OFFSET — limit(0) would make EXPLAIN estimate 0 rows
      const countQb = qb.clone().select('COUNT(*)', 'cnt').offset(undefined).limit(undefined)
      const sql = countQb.getQuery()
      const parameters = countQb.getParameters()

      // Build ordered parameter array matching $1, $2, ... placeholder order
      const paramKeys = Object.keys(parameters).sort((a, b) => {
        // Sort numerically if keys are numeric (orm_param_0, etc.) or by natural order
        const aNum = parseInt(a.replace(/\D/g, ''), 10)
        const bNum = parseInt(b.replace(/\D/g, ''), 10)
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
        return a.localeCompare(b)
      })
      const paramValues = paramKeys.map(k => parameters[k])

      // EXPLAIN (no ANALYZE) — planner estimate only, no execution
      const result = await this.dataSource.query(
        `EXPLAIN (FORMAT JSON) ${sql}`,
        paramValues,
      )

      const plan = result[0]?.['QUERY PLAN']?.[0]?.Plan
      const estimatedRows = Math.round(plan?.['Plan Rows'] ?? 0)

      this.logger.debug('EXPLAIN estimate', { estimatedRows, sql: sql.substring(0, 200) })
      return estimatedRows
    } catch (error) {
      this.logger.warn('EXPLAIN estimate failed, falling back to 0', {
        error: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  // ---------------------------------------------------------------------------
  // Background exact count (bounded concurrency)
  // ---------------------------------------------------------------------------

  /**
   * Fire-and-forget: runs the real COUNT query outside the request lifecycle.
   * Once complete, overwrites the approximate entry in both cache layers
   * with the exact count and a longer TTL.
   *
   * Bounded by maxConcurrentBackgroundCounts to prevent pool exhaustion.
   */
  private queueExactCount(
    key: string,
    qb: SelectQueryBuilder<any>,
  ): void {
    if (this.activeBackgroundCounts >= this.resolvedConfig.maxConcurrentBackgroundCounts) {
      this.logger.debug(`Background count skipped (at limit ${this.resolvedConfig.maxConcurrentBackgroundCounts}): ${key}`)
      return
    }

    this.pendingJobs.add(key)
    this.activeBackgroundCounts++

    setImmediate(async () => {
      try {
        this.logger.debug(`Background exact count started: ${key}`)
        const exactCount = await qb.clone().getCount()

        const result: CountResult = {
          count: exactCount,
          isApproximate: false,
          source: 'exact',
        }

        await this.store(key, result, this.resolvedConfig.exactTtl)
        this.logger.debug(`Background exact count complete: ${key} → ${exactCount}`)
      } catch (error) {
        this.logger.error(`Background exact count failed: ${key}`, {
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        this.pendingJobs.delete(key)
        this.activeBackgroundCounts--
      }
    })
  }

  // ---------------------------------------------------------------------------
  // L1 LRU helpers
  // ---------------------------------------------------------------------------

  private getLru(key: string): CountResult | null {
    const entry = this.lru.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.lru.delete(key)
      return null
    }

    // Promote to end of Map for true LRU eviction order
    this.lru.delete(key)
    this.lru.set(key, entry)

    return entry.result
  }

  private setLru(key: string, result: CountResult): void {
    // Delete first so re-insert goes to end (maintains LRU order)
    this.lru.delete(key)

    // Evict least-recently-used entry when at capacity
    if (this.lru.size >= this.resolvedConfig.lruMaxSize) {
      const firstKey = this.lru.keys().next().value
      if (firstKey) this.lru.delete(firstKey)
    }

    this.lru.set(key, {
      result,
      expiresAt: Date.now() + this.resolvedConfig.lruTtlMs,
    })
  }

  // ---------------------------------------------------------------------------
  // Write-through helper — always writes both layers together
  // ---------------------------------------------------------------------------

  private async store(
    key: string,
    result: CountResult,
    ttlSeconds: number,
  ): Promise<void> {
    this.setLru(key, result)
    await this.cache.set(key, result, ttlSeconds)
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleDestroy(): Promise<void> {
    this.lru.clear()
    this.pendingJobs.clear()
  }
}
