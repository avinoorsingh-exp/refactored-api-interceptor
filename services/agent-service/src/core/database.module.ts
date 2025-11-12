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

        logger.info('Initializing database connection', {
          host: cfg.DB_HOST,
          port: cfg.DB_PORT,
          database: cfg.DB_NAME,
          ssl: cfg.DB_SSL
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
          
          // Auto-schema sync (ONLY for development)
          synchronize: cfg.NODE_ENV === 'dev',
          
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
          ssl: cfg.DB_SSL ? {
            rejectUnauthorized: false,
            checkServerIdentity: () => undefined,
            minVersion: 'TLSv1.2' as const,
          } : false,
        }
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}