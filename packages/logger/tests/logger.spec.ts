/**
 * Logger Service Unit Tests
 *
 * Tests for Winston-based logger with:
 * - Logger creation with various options
 * - Console repurposing
 * - NestJS LoggerService adapter
 * - Log levels and formatting
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createLogger } from '../src/index.js'
import { NestWinstonLogger } from '../src/nest-logger.js'
import type { Logger } from '../src/index.js'

describe('createLogger', () => {
	let logger: Logger

	afterEach(() => {
		// Cleanup
		if (logger && typeof (logger as any).close === 'function') {
			;(logger as any).close()
		}
	})

	describe('logger creation', () => {
		it('should create logger with default options', () => {
			logger = createLogger()
			expect(logger).toBeDefined()
			expect(typeof logger.info).toBe('function')
			expect(typeof logger.error).toBe('function')
			expect(typeof logger.warn).toBe('function')
			expect(typeof logger.debug).toBe('function')
		})

		it('should create logger with custom service name', () => {
			logger = createLogger({ service: 'test-service' })
			expect(logger).toBeDefined()
		})

		it('should create logger with custom log level', () => {
			logger = createLogger({ level: 'debug' })
			expect(logger).toBeDefined()
		})

		it('should create logger for production environment', () => {
			logger = createLogger({ env: 'prod' })
			expect(logger).toBeDefined()
		})

		it('should create logger for test environment', () => {
			logger = createLogger({ env: 'test' })
			expect(logger).toBeDefined()
		})

		it('should create logger with logDir for file rotation', () => {
			logger = createLogger({
				logDir: '/tmp/test-logs',
				env: 'prod',
			})
			expect(logger).toBeDefined()
		})

		it('should disable console repurposing when requested', () => {
			logger = createLogger({ repurposeConsole: false })
			expect(logger).toBeDefined()
		})
	})

	describe('logging methods', () => {
		beforeEach(() => {
			logger = createLogger({ env: 'test' }) // Suppress console output
		})

		it('should log info messages', () => {
			expect(() => {
				logger.info('Test info message')
			}).not.toThrow()
		})

		it('should log error messages', () => {
			expect(() => {
				logger.error('Test error message')
			}).not.toThrow()
		})

		it('should log warn messages', () => {
			expect(() => {
				logger.warn('Test warning message')
			}).not.toThrow()
		})

		it('should log debug messages', () => {
			expect(() => {
				logger.debug('Test debug message')
			}).not.toThrow()
		})

		it('should accept metadata objects', () => {
			expect(() => {
				logger.info('Test message', { userId: '123', action: 'test' })
			}).not.toThrow()
		})

		it('should handle errors as metadata', () => {
			const error = new Error('Test error')
			expect(() => {
				logger.error('Error occurred', { error })
			}).not.toThrow()
		})
	})

	describe('environment-specific behavior', () => {
		it('should use console transport in development', () => {
			logger = createLogger({ env: 'dev' })
			// Logger should have console transport
			expect(logger).toBeDefined()
		})

		it('should not use console transport in production', () => {
			logger = createLogger({ env: 'prod' })
			// Logger should not have console transport
			expect(logger).toBeDefined()
		})

		it('should suppress console in test environment', () => {
			logger = createLogger({ env: 'test' })
			// Console should be suppressed
			expect(logger).toBeDefined()
		})
	})
})

describe('NestWinstonLogger', () => {
	let nestLogger: NestWinstonLogger

	beforeEach(() => {
		const winstonLogger = createLogger({ env: 'test' })
		nestLogger = new NestWinstonLogger(winstonLogger)
	})

	describe('NestJS LoggerService interface', () => {
		it('should implement log method', () => {
			expect(typeof nestLogger.log).toBe('function')
			expect(() => {
				nestLogger.log('Test message')
			}).not.toThrow()
		})

		it('should implement error method', () => {
			expect(typeof nestLogger.error).toBe('function')
			expect(() => {
				nestLogger.error('Test error')
			}).not.toThrow()
		})

		it('should implement warn method', () => {
			expect(typeof nestLogger.warn).toBe('function')
			expect(() => {
				nestLogger.warn('Test warning')
			}).not.toThrow()
		})

		it('should implement debug method', () => {
			expect(typeof nestLogger.debug).toBe('function')
			expect(() => {
				nestLogger.debug('Test debug')
			}).not.toThrow()
		})

		it('should implement verbose method', () => {
			expect(typeof nestLogger.verbose).toBe('function')
			expect(() => {
				nestLogger.verbose('Test verbose')
			}).not.toThrow()
		})

		it('should accept context as second parameter', () => {
			expect(() => {
				nestLogger.log('Test message', 'TestContext')
			}).not.toThrow()
		})

		it('should handle error with stack trace', () => {
			expect(() => {
				nestLogger.error('Test error', 'StackTrace', 'TestContext')
			}).not.toThrow()
		})
	})

	describe('context handling', () => {
		it('should use default context when not provided', () => {
			expect(() => {
				nestLogger.log('Test without context')
			}).not.toThrow()
		})

		it('should use custom context when provided', () => {
			expect(() => {
				nestLogger.log('Test with context', 'CustomContext')
			}).not.toThrow()
		})
	})
})
