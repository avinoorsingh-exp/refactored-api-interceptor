import { Test, TestingModule } from '@nestjs/testing'
import { LoggerService } from './logger.service'
import { ConfigService } from './config.service'
import { AsyncContextStorage, RequestContext } from '@exprealty/cache'

// Mock the external logger module
jest.mock('@exprealty/logger', () => ({
	createLogger: jest.fn().mockReturnValue({
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
	}),
	MetricsService: jest.fn().mockImplementation(() => ({
		recordMetric: jest.fn(),
	})),
}))

import { createLogger } from '@exprealty/logger'

describe('LoggerService', () => {
	let service: LoggerService
	let mockConfigService: jest.Mocked<ConfigService>
	let mockLogger: ReturnType<typeof createLogger>

	beforeEach(async () => {
		jest.clearAllMocks()

		mockConfigService = {
			get: jest.fn().mockImplementation((key: string) => {
				const config: Record<string, any> = {
					NODE_ENV: 'test',
					LOG_LEVEL: 'info',
					LOG_DIR: '/var/log',
					METRICS_EXPORTER_ENDPOINT: 'http://localhost:4318',
					METRICS_EXPORTER_PROTOCOL: 'http',
					METRICS_EXPORT_INTERVAL_MS: 10000,
					METRICS_ENABLE_DIAGNOSTICS: false,
					METRICS_DIAGNOSTICS_VERBOSE: false,
					METRICS_EXPORTER_HEADERS: '{"Authorization": "Bearer test"}',
				}
				return config[key]
			}),
		} as unknown as jest.Mocked<ConfigService>

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LoggerService,
				{
					provide: ConfigService,
					useValue: mockConfigService,
				},
			],
		}).compile()

		service = module.get<LoggerService>(LoggerService)
		mockLogger = (createLogger as jest.Mock).mock.results[0].value
	})

	describe('info()', () => {
		it('should log info message with context', () => {
			service.info('Test message', { key: 'value' })
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', { key: 'value' })
		})

		it('should log info message without meta', () => {
			service.info('Simple message')
			expect(mockLogger.info).toHaveBeenCalledWith('Simple message', {})
		})

		it('should include context when set', () => {
			service.setContext('TestClass')
			service.info('Message with context')
			expect(mockLogger.info).toHaveBeenCalledWith('Message with context', { context: 'TestClass' })
		})
	})

	describe('error()', () => {
		it('should log error message with context', () => {
			service.error('Error occurred', { error: 'details' })
			expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', { error: 'details' })
		})

		it('should log error message without meta', () => {
			service.error('Error message')
			expect(mockLogger.error).toHaveBeenCalledWith('Error message', {})
		})

		it('should include context when set', () => {
			service.setContext('ErrorHandler')
			service.error('Error with context')
			expect(mockLogger.error).toHaveBeenCalledWith('Error with context', { context: 'ErrorHandler' })
		})
	})

	describe('warn()', () => {
		it('should log warn message with context', () => {
			service.warn('Warning message', { warning: 'info' })
			expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', { warning: 'info' })
		})

		it('should log warn message without meta', () => {
			service.warn('Simple warning')
			expect(mockLogger.warn).toHaveBeenCalledWith('Simple warning', {})
		})

		it('should include context when set', () => {
			service.setContext('WarningHandler')
			service.warn('Warning with context')
			expect(mockLogger.warn).toHaveBeenCalledWith('Warning with context', { context: 'WarningHandler' })
		})
	})

	describe('debug()', () => {
		it('should log debug message with context', () => {
			service.debug('Debug message', { debug: 'data' })
			expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', { debug: 'data' })
		})

		it('should log debug message without meta', () => {
			service.debug('Simple debug')
			expect(mockLogger.debug).toHaveBeenCalledWith('Simple debug', {})
		})

		it('should include context when set', () => {
			service.setContext('DebugHandler')
			service.debug('Debug with context')
			expect(mockLogger.debug).toHaveBeenCalledWith('Debug with context', { context: 'DebugHandler' })
		})
	})

	describe('setContext()', () => {
		it('should set context for subsequent log messages', () => {
			service.setContext('MyService')
			service.info('Test')
			expect(mockLogger.info).toHaveBeenCalledWith('Test', { context: 'MyService' })
		})

		it('should override previous context', () => {
			service.setContext('FirstContext')
			service.setContext('SecondContext')
			service.info('Test')
			expect(mockLogger.info).toHaveBeenCalledWith('Test', { context: 'SecondContext' })
		})

		it('should set context in AsyncContextStorage when available', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-123',
				timestamp: Date.now(),
			}

			AsyncContextStorage.run(mockContext, () => {
				service.setContext('AsyncService')
				service.info('Test')
				
				// Verify context was set in AsyncContextStorage
				const loggerContext = AsyncContextStorage.getLoggerContext()
				expect(loggerContext?.serviceName).toBe('AsyncService')
				
				// Verify log was called with correct context
				expect(mockLogger.info).toHaveBeenCalledWith('Test', { context: 'AsyncService' })
			})
		})

		it('should fallback to local storage when not in async context', () => {
			// Not in async context
			service.setContext('LocalService')
			service.info('Test')
			
			// Should use local storage
			expect(mockLogger.info).toHaveBeenCalledWith('Test', { context: 'LocalService' })
		})

		it('should preserve sourceType when setting context in async storage', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-456',
				timestamp: Date.now(),
				requestPath: '/api/test',
				method: 'GET',
				loggerContext: {
					sourceType: 'http',
				},
			}

			AsyncContextStorage.run(mockContext, () => {
				service.setContext('HttpService')
				const loggerContext = AsyncContextStorage.getLoggerContext()
				
				// Should preserve sourceType
				expect(loggerContext?.sourceType).toBe('http')
				expect(loggerContext?.serviceName).toBe('HttpService')
			})
		})
	})

	describe('serviceCall()', () => {
		it('should log valid service call event', () => {
			const validInput = {
				serviceCall: 'agent:states',
				endpoint: '/states',
				method: 'GET' as const,
				status: 200,
				ok: true,
				duration_ms: 50,
			}

			service.serviceCall(validInput)
			expect(mockLogger.info).toHaveBeenCalledWith(
				'provider_call',
				expect.objectContaining({
					event: 'service_call',
					service: 'agent-service',
					env: 'test',
					...validInput,
				}),
			)
		})

		it('should log warning for invalid service call event', () => {
			const invalidInput = {
				// Missing required fields
				endpoint: '/test',
			}

			service.serviceCall(invalidInput as any)
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'provider_call_invalid',
				expect.objectContaining({
					raw: invalidInput,
				}),
			)
		})

		it('should handle service call with optional fields', () => {
			const inputWithOptionals = {
				serviceCall: 'agent:companies',
				endpoint: '/companies',
				method: 'POST' as const,
				status: 201,
				ok: true,
				duration_ms: 100,
				request_id: '550e8400-e29b-41d4-a716-446655440000',
				retries: 1,
			}

			service.serviceCall(inputWithOptionals)
			expect(mockLogger.info).toHaveBeenCalledWith(
				'provider_call',
				expect.objectContaining({
					event: 'service_call',
					request_id: '550e8400-e29b-41d4-a716-446655440000',
					retries: 1,
				}),
			)
		})
	})

	describe('getMetrics()', () => {
		it('should return the metrics service instance', () => {
			const metrics = service.getMetrics()
			expect(metrics).toBeDefined()
		})
	})

	describe('constructor', () => {
		it('should handle invalid METRICS_EXPORTER_HEADERS JSON', async () => {
			mockConfigService.get.mockImplementation((key: string) => {
				if (key === 'METRICS_EXPORTER_HEADERS') return 'invalid-json'
				if (key === 'NODE_ENV') return 'test'
				return undefined
			})

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					LoggerService,
					{
						provide: ConfigService,
						useValue: mockConfigService,
					},
				],
			}).compile()

			// Should not throw, just log warning
			const loggerService = module.get<LoggerService>(LoggerService)
			expect(loggerService).toBeDefined()
		})

		it('should handle missing METRICS_EXPORTER_HEADERS', async () => {
			mockConfigService.get.mockImplementation((key: string) => {
				if (key === 'METRICS_EXPORTER_HEADERS') return undefined
				if (key === 'NODE_ENV') return 'test'
				return undefined
			})

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					LoggerService,
					{
						provide: ConfigService,
						useValue: mockConfigService,
					},
				],
			}).compile()

			const loggerService = module.get<LoggerService>(LoggerService)
			expect(loggerService).toBeDefined()
		})
	})
})
