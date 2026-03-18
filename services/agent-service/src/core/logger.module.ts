// services/agent-service/src/core/logger.module.ts
import { Module, Global } from '@nestjs/common'
import { LoggerService } from './logger.service.js'

/**
 * Logger Module
 * 
 * Global module that provides LoggerService across the application.
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
