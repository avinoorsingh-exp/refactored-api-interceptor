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
            max: 30,  // Maximum pool size (1 ECS task, RDS max_connections=181, ~10 reserved for admin)
            min: 10,  // Minimum pool size - pre-warm connections for Kafka + API + cron
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
            console.log('[DatabaseModule] SSL config being used:', sslConfig);
            return sslConfig;
          })(),
        }
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}