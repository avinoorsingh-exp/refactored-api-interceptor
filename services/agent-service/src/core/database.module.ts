// services/agent-service/src/core/database.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigService } from './config.service.js'
import { LoggerService } from './logger.service.js'
import { LoggerModule } from './logger.module.js'

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
        
        // Debug: Log SSL configuration
        console.log('[DatabaseModule] DB_SSL value:', cfg.DB_SSL, 'type:', typeof cfg.DB_SSL)

        // Diagnostic: print SSL value early (use console to ensure it appears
        // even if logger isn't fully ready). This helps verify the value we
        // received from ConfigService / AWS Secrets Manager.
        // eslint-disable-next-line no-console
        console.log('[DB DIAG] cfg.DB_SSL ->', cfg.DB_SSL, 'typeof ->', typeof cfg.DB_SSL, 'process.env.DB_SSL ->', process.env.DB_SSL)

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
            max: 20, // Maximum pool size
            min: 2,  // Minimum pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
          },
          
          // SSL configuration
          // Uses DB_SSL from config (loaded from AWS Secrets Manager or .env)
          ssl: (() => {
            const sslConfig = cfg.DB_SSL ? {
              rejectUnauthorized: false,
              checkServerIdentity: () => undefined,
              minVersion: 'TLSv1.2' as const,
            } : false
            console.log('[DatabaseModule] SSL config being used:', sslConfig)
            return sslConfig
          })(),
        }
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}