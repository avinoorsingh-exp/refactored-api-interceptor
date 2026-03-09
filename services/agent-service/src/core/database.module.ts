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
 * Queries that warm the PostgreSQL buffer cache on startup.
 * Each query touches pages that the first real request would otherwise
 * read from disk, eliminating cold-cache latency after deploys.
 *
 * Guidelines for adding warmup queries:
 * - Only add queries for large tables used by high-traffic endpoints
 * - Use COUNT(*) or LIMIT 1 — we need page reads, not result sets
 * - Keep the list short; total warmup should complete in < 5s
 */
const CACHE_WARMUP_QUERIES = [
  // Agent table (~267K rows) — most common list endpoint
  `SELECT COUNT(*) FROM core.agent`,
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

      // Phase 2: Buffer cache warmup
      // Touches hot table pages so Postgres loads them into shared_buffers.
      const cacheStart = Date.now()
      for (const sql of CACHE_WARMUP_QUERIES) {
        await this.dataSource.query(sql)
      }
      const cacheElapsed = Date.now() - cacheStart
      this.logger.info(`[DatabaseModule] Buffer cache pre-warmed: ${CACHE_WARMUP_QUERIES.length} queries in ${cacheElapsed}ms`)
    } catch (error) {
      // Non-fatal: pool and cache will warm on demand
      this.logger.warn('[DatabaseModule] Pre-warm failed, resources will be created on demand', {
        error: (error as Error).message,
      })
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
