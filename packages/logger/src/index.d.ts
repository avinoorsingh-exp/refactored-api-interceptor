import winston from 'winston'
export interface LoggerOptions {
	service?: string
	level?: string
	logDir?: string
	env?: 'local' | 'dev' | 'test' | 'prod'
	repurposeConsole?: boolean
}
/**
 * Create a Winston logger with sensible defaults.
 * - Console output only in development
 * - Optional daily-rotating file logs if logDir is set
 * - Optionally repurposes console.* to Winston (suppressed outside dev)
 */
export declare function createLogger(opts?: LoggerOptions): winston.Logger
/**
 * Redirect console.* to Winston logger.
 * Console output is emitted only when isLocal === true (development).
 */
export declare function redirectConsole(logger: winston.Logger, isLocal: boolean): void
export type Logger = ReturnType<typeof createLogger>
