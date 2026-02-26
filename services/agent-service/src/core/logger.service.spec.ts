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

jest.mock('@exprealty/logger/log-tier', () => ({
	LogTier: {
		CRITICAL: 'critical',
		OPERATIONAL: 'operational',
		LIFECYCLE: 'lifecycle',
		DEBUG: 'debug',
	},
	shouldForwardLog: jest.fn((tier: string) => tier === 'critical' || tier === 'operational'),
}))

import { createLogger } from '@exprealty/logger'

describe('LoggerService', () => {
	let service: LoggerService
	let mockConfigService: jest.Mocked<ConfigService>
	let mockLogger: ReturnType<typeof createLogger>

	beforeEach(async () => {
		jest.clearAllMocks()

		// Re-set mock return value after clearAllMocks wipes it
		;(createLogger as jest.Mock).mockReturnValue({
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		})

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
		await service.onModuleInit()
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

	describe('critical()', () => {
		it('should log at error level with CRITICAL tier and dd.forward true', () => {
			service.critical('DB connection lost', { code: '08001' })
			expect(mockLogger.error).toHaveBeenCalledWith('DB connection lost', {
				tier: 'critical',
				'dd.forward': true,
				code: '08001',
			})
		})

		it('should log without meta', () => {
			service.critical('Unhandled exception')
			expect(mockLogger.error).toHaveBeenCalledWith('Unhandled exception', {
				tier: 'critical',
				'dd.forward': true,
			})
		})

		it('should include context when set', () => {
			service.setContext('AgentService')
			service.critical('Query failed')
			expect(mockLogger.error).toHaveBeenCalledWith('Query failed', {
				context: 'AgentService',
				tier: 'critical',
				'dd.forward': true,
			})
		})
	})

	describe('operational()', () => {
		it('should log at info level with OPERATIONAL tier and dd.forward true', () => {
			service.operational('GET /v1/agents completed', { durationMs: 42, status: 200 })
			expect(mockLogger.info).toHaveBeenCalledWith('GET /v1/agents completed', {
				tier: 'operational',
				'dd.forward': true,
				durationMs: 42,
				status: 200,
			})
		})

		it('should log without meta', () => {
			service.operational('Service listening on port 3000')
			expect(mockLogger.info).toHaveBeenCalledWith('Service listening on port 3000', {
				tier: 'operational',
				'dd.forward': true,
			})
		})
	})

	describe('lifecycle()', () => {
		it('should log at info level with LIFECYCLE tier and dd.forward false', () => {
			service.lifecycle('Bootstrap step 1 complete')
			expect(mockLogger.info).toHaveBeenCalledWith('Bootstrap step 1 complete', {
				tier: 'lifecycle',
				'dd.forward': false,
			})
		})

		it('should include meta', () => {
			service.lifecycle('Module initialized', { module: 'TypeOrmModule' })
			expect(mockLogger.info).toHaveBeenCalledWith('Module initialized', {
				tier: 'lifecycle',
				'dd.forward': false,
				module: 'TypeOrmModule',
			})
		})
	})

	describe('debugTiered()', () => {
		it('should log at debug level with DEBUG tier and dd.forward false', () => {
			service.debugTiered('Aggregation SQL', { sql: 'SELECT ...' })
			expect(mockLogger.debug).toHaveBeenCalledWith('Aggregation SQL', {
				tier: 'debug',
				'dd.forward': false,
				sql: 'SELECT ...',
			})
		})

		it('should log without meta', () => {
			service.debugTiered('Diagnostic query')
			expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostic query', {
				tier: 'debug',
				'dd.forward': false,
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

	describe('createScopedLogger()', () => {
		it('should return a ScopedLogger with fixed context', () => {
			const child = service.createScopedLogger('NoteController')
			child.info('Test message')
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', { context: 'NoteController' })
		})

		it('should not be affected by parent setContext', () => {
			const child = service.createScopedLogger('NoteController')
			service.setContext('ApiActorMiddleware') // simulate middleware stomping
			child.info('Still my context')
			expect(mockLogger.info).toHaveBeenCalledWith('Still my context', { context: 'NoteController' })
		})

		it('should not be affected by AsyncContextStorage', () => {
			const child = service.createScopedLogger('NoteController')
			const mockContext: RequestContext = {
				correlationId: 'test-123',
				timestamp: Date.now(),
				loggerContext: { serviceName: 'SomeMiddleware' },
			}

			AsyncContextStorage.run(mockContext, () => {
				child.info('Isolated context')
				expect(mockLogger.info).toHaveBeenCalledWith('Isolated context', { context: 'NoteController' })
			})
		})

		it('should support tier-aware methods', () => {
			const child = service.createScopedLogger('PerfInterceptor')
			child.operational('Slow query', { durationMs: 500 })
			expect(mockLogger.info).toHaveBeenCalledWith('Slow query', {
				context: 'PerfInterceptor',
				tier: 'operational',
				'dd.forward': true,
				durationMs: 500,
			})
		})

		it('should support critical tier', () => {
			const child = service.createScopedLogger('ErrorHandler')
			child.critical('DB down')
			expect(mockLogger.error).toHaveBeenCalledWith('DB down', {
				context: 'ErrorHandler',
				tier: 'critical',
				'dd.forward': true,
			})
		})

		it('should support lifecycle tier', () => {
			const child = service.createScopedLogger('Bootstrap')
			child.lifecycle('Module loaded')
			expect(mockLogger.info).toHaveBeenCalledWith('Module loaded', {
				context: 'Bootstrap',
				tier: 'lifecycle',
				'dd.forward': false,
			})
		})

		it('should support debugTiered', () => {
			const child = service.createScopedLogger('QueryBuilder')
			child.debugTiered('SQL trace', { sql: 'SELECT 1' })
			expect(mockLogger.debug).toHaveBeenCalledWith('SQL trace', {
				context: 'QueryBuilder',
				tier: 'debug',
				'dd.forward': false,
				sql: 'SELECT 1',
			})
		})

		it('should ignore setContext calls (no-op)', () => {
			const child = service.createScopedLogger('FixedContext')
			child.setContext('Ignored')
			child.info('Still fixed')
			expect(mockLogger.info).toHaveBeenCalledWith('Still fixed', { context: 'FixedContext' })
		})

		it('should support error and warn methods', () => {
			const child = service.createScopedLogger('TestChild')
			child.error('An error', { code: 500 })
			child.warn('A warning')
			expect(mockLogger.error).toHaveBeenCalledWith('An error', { context: 'TestChild', code: 500 })
			expect(mockLogger.warn).toHaveBeenCalledWith('A warning', { context: 'TestChild' })
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
