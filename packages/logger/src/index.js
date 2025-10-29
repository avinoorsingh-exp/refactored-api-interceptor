import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
/**
 * Create a Winston logger with sensible defaults.
 * - Console output only in development
 * - Optional daily-rotating file logs if logDir is set
 * - Optionally repurposes console.* to Winston (suppressed outside dev)
 */
export function createLogger(opts = {}) {
	const {
		service = 'app',
		level = opts.level ?? process.env.LOG_LEVEL ?? 'info',
		logDir = opts.logDir ?? process.env.LOG_DIR,
		env = opts.env ?? process.env.NODE_ENV ?? 'development',
		repurposeConsole = true,
	} = opts
	const isLocal = env === 'development'
	const transports = []
	// Console transport only in local/dev
	if (isLocal) {
		transports.push(
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize(),
					winston.format.timestamp({ format: 'HH:mm:ss' }),
					winston.format.printf((info) => {
						const { timestamp, level: lvl, message, ...meta } = info
						const safeTimestamp = typeof timestamp === 'string' ? timestamp : ''
						const metaRecord = meta
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
	process.on('unhandledRejection', (reason) => {
		const error = reason instanceof Error ? reason : new Error(String(reason))
		logger.error('UnhandledRejection', { error: error.message, stack: error.stack })
	})
	process.on('uncaughtException', (err) => {
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
export function redirectConsole(logger, isLocal) {
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
