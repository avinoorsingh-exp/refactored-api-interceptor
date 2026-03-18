// ESM-compatible
import type { LoggerService } from '@nestjs/common'
import type winston from 'winston'

const toStr = (v: unknown) =>
  typeof v === 'string' ? v : (() => { try { return JSON.stringify(v) } catch { return String(v) } })()

export class NestWinstonLogger implements LoggerService {
  constructor(private readonly logger: winston.Logger) {}

  // Nest’s "log" -> Winston info
  log(message: any, context?: string) {
    this.logger.info(toStr(message), context ? { context } : undefined)
  }
  error(message: any, trace?: string, context?: string) {
    this.logger.error(toStr(message), { trace, ...(context ? { context } : {}) })
  }
  warn(message: any, context?: string) {
    this.logger.warn(toStr(message), context ? { context } : undefined)
  }
  debug(message: any, context?: string) {
    this.logger.debug(toStr(message), context ? { context } : undefined)
  }
  verbose(message: any, context?: string) {
    // map verbose -> debug (or keep .verbose if your levels include it)
    this.logger.debug(toStr(message), context ? { context } : undefined)
  }
}
