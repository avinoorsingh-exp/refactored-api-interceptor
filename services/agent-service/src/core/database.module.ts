// services/agent-service/src/core/database.module.ts
import { Module, OnModuleInit, Injectable } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ConfigService } from './config.service.js'
import { LoggerService } from './logger.service.js'
import { LoggerModule } from './logger.module.js'

/** Number of connections to pre-warm on startup */
const POOL_WARM_SIZE = 5

/**
 * Relations to pre-warm via pg_prewarm(). Loads ALL pages of each relation/index
 * into shared_buffers — more thorough than running sample queries.
 * Requires the pg_prewarm extension (migration 1772100000000).
 */
const PG_PREWARM_RELATIONS = [
  // Core tables
  'core.agent',
  'core.contact_method',
  // GIN indexes — biggest cold start offenders
  // Identifiers must be double-quoted to preserve case in pg_prewarm()
  'core."IDX_contact_method_value_trgm"',
  'core."IDX_agent_search_vector"',
  // Btree indexes used by most filtered queries
  'core."IDX_agent_lifecycle_status"',
  'core."IDX_contact_method_agent_id_value"',
]

/**
 * Fallback queries when pg_prewarm is not available.
 * Each query touches index pages that the first real request would otherwise
 * read from disk, eliminating cold-cache latency after deploys.
 */
const CACHE_WARMUP_QUERIES = [
  // Agent table (~267K rows) — most common list endpoint
  `SELECT COUNT(*) FROM core.agent`,
  // Lifecycle status btree index — used by nearly every filtered query
  `SELECT COUNT(*) FROM core.agent WHERE lifecycle_status = 'Active'`,
  // FTS GIN index (search_vector) — used by free-text search
  `SELECT COUNT(*) FROM core.agent WHERE search_vector @@ to_tsquery('simple', 'smith:*')`,
  // Trigram GIN index on contact_method.value — used by email ilike filters
  `SELECT COUNT(*) FROM core.contact_method WHERE value ILIKE '%@exprealty.com%'`,
  // Contact methods — post-loaded for every agent list request
  `SELECT 1 FROM core.contact_method LIMIT 1`,
  // Address chain — post-loaded for primaryAddress include
  `SELECT 1 FROM core.agent_address aa JOIN core.address a ON a.id = aa.address_id LIMIT 1`,
]

/**
 * Pre-warms the database connection pool and PostgreSQL buffer cache on startup.
 *
 * Phase 1: Opens POOL_WARM_SIZE connections in parallel (TCP + TLS handshake).
 * Phase 2: Runs CACHE_WARMUP_QUERIES to load hot table pages into shared_buffers
 *          so the first real request doesn't pay disk I/O costs.
 *
 * Both phases are non-fatal — if they fail, connections and cache pages are
 * created on demand.
 */
@Injectable()
class DatabaseWarmupService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const start = Date.now()
    try {
      // Phase 1: Connection pool warmup
      // Each query forces pg-pool to open a new connection (up to pool max).
      await Promise.all(
        Array.from({ length: POOL_WARM_SIZE }, () =>
          this.dataSource.query('SELECT 1'),
        ),
      )
      const poolElapsed = Date.now() - start
      this.logger.info(`[DatabaseModule] Connection pool pre-warmed: ${POOL_WARM_SIZE} connections in ${poolElapsed}ms`)

      // Phase 2: Buffer cache warmup via pg_prewarm (preferred) or fallback queries
      const cacheStart = Date.now()
      const usedPgPrewarm = await this.tryPgPrewarm()

      if (!usedPgPrewarm) {
        // Fallback: run queries that touch hot index pages
        for (const sql of CACHE_WARMUP_QUERIES) {
          await this.dataSource.query(sql)
        }
        this.logger.info(`[DatabaseModule] Buffer cache pre-warmed via queries: ${CACHE_WARMUP_QUERIES.length} queries in ${Date.now() - cacheStart}ms`)
      }
    } catch (error) {
      // Non-fatal: pool and cache will warm on demand
      this.logger.warn('[DatabaseModule] Pre-warm failed, resources will be created on demand', {
        error: (error as Error).message,
      })
    }
  }

  /**
   * Attempt to use pg_prewarm() to load hot tables and indexes into shared_buffers.
   * Returns true if pg_prewarm was available and succeeded, false to fall back to queries.
   */
  private async tryPgPrewarm(): Promise<boolean> {
    try {
      // Check if pg_prewarm extension is installed
      const [ext] = await this.dataSource.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'pg_prewarm'`,
      )
      if (!ext) return false

      const prewarmStart = Date.now()
      let totalBlocks = 0
      const warmed: string[] = []
      const failed: string[] = []

      for (const relation of PG_PREWARM_RELATIONS) {
        try {
          // Cast to regclass inline — parameterized $1 doesn't work with regclass
          const [result] = await this.dataSource.query(
            `SELECT pg_prewarm('${relation}'::regclass, 'buffer', 'main') AS blocks`,
          )
          const blocks = parseInt(result?.blocks ?? '0', 10)
          totalBlocks += blocks
          warmed.push(`${relation}(${blocks})`)
        } catch (err) {
          // Relation may not exist yet (e.g. index not created) — log and continue
          failed.push(relation)
          this.logger.debug(`[DatabaseModule] pg_prewarm skipped ${relation}: ${(err as Error).message}`)
        }
      }

      this.logger.info(
        `[DatabaseModule] Buffer cache pre-warmed via pg_prewarm: ${totalBlocks} blocks for ${warmed.length}/${PG_PREWARM_RELATIONS.length} relations in ${Date.now() - prewarmStart}ms`,
        { warmed, ...(failed.length > 0 ? { failed } : {}) },
      )
      return warmed.length > 0
    } catch {
      return false
    }
  }
}

/**
 * Database Module
 *
 * Configures TypeORM connection for the agent service.
 * Uses ConfigService for environment-based configuration.
 */
@Module({
  imports: [
    LoggerModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService, LoggerService],
      useFactory: (config: ConfigService, logger: LoggerService) => {
        const cfg = config.getAll()

        logger.info('Initializing database connection', {
          host: cfg.DB_HOST,
          port: cfg.DB_PORT,
          database: cfg.DB_NAME,
          ssl: cfg.DB_SSL,
          sslType: typeof cfg.DB_SSL,
        })

        return {
          type: 'postgres',
          host: cfg.DB_HOST,
          port: cfg.DB_PORT,
          username: cfg.DB_USERNAME,
          password: cfg.DB_PASSWORD,
          database: cfg.DB_NAME,

          // Entity discovery - autoLoadEntities loads entities from forFeature()
          autoLoadEntities: true,

          // NEVER use synchronize - always use migrations for schema changes.
          // synchronize can cause data loss and conflicts with FK constraints.
          synchronize: false,

          // Logging (conditional based on environment)
          logging: cfg.NODE_ENV === 'dev' ? ['error', 'warn', 'schema'] : ['error'],

          // Connection pool settings
          extra: {
            max: 30,  // Maximum pool size (1 ECS task, RDS max_connections=181, ~10 reserved for admin)
            min: POOL_WARM_SIZE,   // Minimum idle connections to maintain
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            allowExitOnIdle: true, // Allow process to exit if idle (important for ECS task shutdown)
          },

          // SSL configuration
          // Uses DB_SSL from config (loaded from AWS Secrets Manager or .env)
          // Explicitly check for true to avoid "false" string being coerced to true
          ssl: (() => {
            const sslEnabled = cfg.DB_SSL === true || String(cfg.DB_SSL).toLowerCase() === 'true' || String(cfg.DB_SSL) === '1';
            const sslConfig = sslEnabled ? {
              rejectUnauthorized: false,
              checkServerIdentity: () => undefined,
              minVersion: 'TLSv1.2' as const,
            } : false;
            return sslConfig;
          })(),
        }
      },
    }),
  ],
  providers: [DatabaseWarmupService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
