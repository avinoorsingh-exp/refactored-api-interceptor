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
 * Pre-warms the database connection pool on startup.
 * Establishes POOL_WARM_SIZE connections in parallel so the first real
 * request doesn't pay the TCP + TLS handshake cost.
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
      // Run POOL_WARM_SIZE concurrent trivial queries.
      // Each one forces pg-pool to open a new connection (up to pool max).
      await Promise.all(
        Array.from({ length: POOL_WARM_SIZE }, () =>
          this.dataSource.query('SELECT 1'),
        ),
      )
      const elapsed = Date.now() - start
      this.logger.info(`[DatabaseModule] Connection pool pre-warmed: ${POOL_WARM_SIZE} connections in ${elapsed}ms`)
    } catch (error) {
      // Non-fatal: pool will create connections on demand
      this.logger.warn('[DatabaseModule] Pool pre-warm failed, connections will be created on demand', {
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
