/**
 * Logger interface for API monitoring package.
 * 
 * Services using this package must provide a logger implementation
 * that matches this interface.
 * 
 * @public
 */
export interface IApiMonitoringLogger {
	/**
	 * Set the context (e.g., class name) for subsequent log messages.
	 */
	setContext(context: string): void;

	/**
	 * Log an info message.
	 */
	info(message: string, meta?: Record<string, unknown>): void;

	/**
	 * Log an error message.
	 */
	error(message: string, meta?: Record<string, unknown>): void;

	/**
	 * Log a warning message.
	 */
	warn(message: string, meta?: Record<string, unknown>): void;

	/**
	 * Log a debug message.
	 */
	debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Injection token for the API monitoring logger.
 * 
 * @public
 */
export const API_MONITORING_LOGGER_TOKEN = 'API_MONITORING_LOGGER' as const;

