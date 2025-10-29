import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import type { LoggerService } from '@nestjs/common'

export { MetricsService, type MetricsOptions } from './metrics.js'
export type { Meter, Counter, Histogram, UpDownCounter } from '@opentelemetry/api'

type WinstonInfo = {
	level: string
	message: unknown
	timestamp?: unknown
	[key: string]: unknown
}

export interface LoggerOptions {
	service?: string // e.g. "gmail-processor"
	level?: string // typically cfg.LOG_LEVEL
	logDir?: string // typically cfg.LOG_DIR
	env?: 'development' | 'test' | 'production' // typically cfg.NODE_ENV
	repurposeConsole?: boolean // auto-redirect console.* (default true)
}

/**
 * Create a Winston logger with sensible defaults.
 * - Console output only in development
 * - Optional daily-rotating file logs if logDir is set
 * - Optionally repurposes console.* to Winston (suppressed outside dev)
 */
export function createLogger(opts: LoggerOptions = {}) {
	const {
		service = 'app',
		level = 'info',
		logDir,
		env = 'development',
		repurposeConsole = true,
	} = opts

	const isLocal = env === 'development'
	const transports: winston.transport[] = []

	// Console transport only in local/dev
	if (isLocal) {
		transports.push(
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize(),
					winston.format.timestamp({ format: 'HH:mm:ss' }),
					winston.format.printf((info: WinstonInfo) => {
						const { timestamp, level: lvl, message, ...meta } = info
						const safeTimestamp = typeof timestamp === 'string' ? timestamp : ''
						const metaRecord = meta as Record<string, unknown>
						const metaKeys = Object.keys(metaRecord)
						const baseMessage = `[${safeTimestamp}] ${service} ${lvl}: ${String(message)}`
						return metaKeys.length
							? `${baseMessage} ${JSON.stringify(metaRecord)}`
							: baseMessage
					}),
				),
			}),
		)
	}

	// Optional rotating file transport
	if (logDir) {
		transports.push(
			new DailyRotateFile({
				dirname: logDir,
				filename: `${service}-%DATE%.log`,
				datePattern: 'YYYY-MM-DD',
				maxFiles: '14d',
				zippedArchive: true,
				level,
				format: winston.format.combine(
					winston.format.timestamp(),
					winston.format.errors({ stack: true }),
					winston.format.json(),
				),
			}),
		)
	}

	const logger = winston.createLogger({
		level,
		defaultMeta: { service },
		transports,
	})

	// Handle unhandled rejections/exceptions
	process.on('unhandledRejection', (reason: unknown) => {
		const error = reason instanceof Error ? reason : new Error(String(reason))
		logger.error('UnhandledRejection', { error: error.message, stack: error.stack })
	})
	process.on('uncaughtException', (err: Error) => {
		logger.error('UncaughtException', { error: err.message, stack: err.stack })
	})

	if (repurposeConsole) {
		redirectConsole(logger, isLocal)
	}

	return logger
}

/**
 * Redirect console.* to Winston logger.
 * Console output is emitted only when isLocal === true (development).
 */
export function redirectConsole(logger: winston.Logger, isLocal: boolean) {
	console.log = (...args) => {
		if (isLocal) logger.info(args.map(String).join(' '))
	}
	console.info = (...args) => {
		if (isLocal) logger.info(args.map(String).join(' '))
	}
	console.warn = (...args) => {
		if (isLocal) logger.warn(args.map(String).join(' '))
	}
	console.error = (...args) => {
		if (isLocal) logger.error(args.map(String).join(' '))
	}
	console.debug = (...args) => {
		if (isLocal) logger.debug(args.map(String).join(' '))
	}
}

// Convenience type
export type Logger = ReturnType<typeof createLogger>

/**
 * Nest-compatible logger adapter that wraps a Winston logger.
 * Use this as the logger for NestFactory.create or app.useLogger().
 */
const toStr = (v: unknown) =>
	typeof v === 'string'
		? v
		: (() => {
				try {
					return JSON.stringify(v)
				} catch {
					return String(v)
				}
			})()

export class NestWinstonLogger implements LoggerService {
	constructor(private readonly logger: winston.Logger) {}

	log(message: unknown, context?: string) {
		this.logger.info(toStr(message), context ? { context } : undefined)
	}
	error(message: unknown, trace?: string, context?: string) {
		this.logger.error(toStr(message), { trace, ...(context ? { context } : {}) })
	}
	warn(message: unknown, context?: string) {
		this.logger.warn(toStr(message), context ? { context } : undefined)
	}
	debug(message: unknown, context?: string) {
		this.logger.debug(toStr(message), context ? { context } : undefined)
	}
	verbose(message: unknown, context?: string) {
		this.logger.debug(toStr(message), context ? { context } : undefined)
	}
}
