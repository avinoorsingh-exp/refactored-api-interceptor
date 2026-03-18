import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { ConfigService } from './config.service'

describe('ConfigService', () => {
	let service: ConfigService
	let mockNestConfigService: jest.Mocked<NestConfigService>

	const mockConfig = {
		NODE_ENV: 'test',
		PORT: 3000,
		LOG_LEVEL: 'info',
		LOG_DIR: '/var/log',
		ALLOWED_ORIGINS: '*',
		S2S_INTERNAL_KEY: 'test-key',
		DB_HOST: 'localhost',
		DB_PORT: 5432,
		DB_USERNAME: 'testuser',
		DB_PASSWORD: 'testpass',
		DB_NAME: 'testdb',
		DB_SSL: false,
		METRICS_EXPORTER_ENDPOINT: 'http://localhost:4318',
		METRICS_EXPORTER_PROTOCOL: 'http',
		METRICS_EXPORT_INTERVAL_MS: 10000,
		METRICS_ENABLE_DIAGNOSTICS: false,
		METRICS_DIAGNOSTICS_VERBOSE: false,
		METRICS_EXPORTER_HEADERS: '{}',
	}

	beforeEach(async () => {
		mockNestConfigService = {
			get: jest.fn().mockImplementation((key: string) => {
				if (key === '') return mockConfig
				return mockConfig[key as keyof typeof mockConfig]
			}),
		} as unknown as jest.Mocked<NestConfigService>

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ConfigService,
				{
					provide: NestConfigService,
					useValue: mockNestConfigService,
				},
			],
		}).compile()

		service = module.get<ConfigService>(ConfigService)
	})

	describe('get()', () => {
		it('should return the value for a given config key', () => {
			expect(service.get('PORT')).toBe(3000)
		})

		it('should return NODE_ENV value', () => {
			expect(service.get('NODE_ENV')).toBe('test')
		})

		it('should return database configuration values', () => {
			expect(service.get('DB_HOST')).toBe('localhost')
			expect(service.get('DB_PORT')).toBe(5432)
			expect(service.get('DB_NAME')).toBe('testdb')
		})
	})

	describe('getAll()', () => {
		it('should return the complete config object', () => {
			const config = service.getAll()
			expect(config).toEqual(mockConfig)
		})

		it('should contain all expected keys', () => {
			const config = service.getAll()
			expect(config).toHaveProperty('NODE_ENV')
			expect(config).toHaveProperty('PORT')
			expect(config).toHaveProperty('DB_HOST')
		})
	})

	describe('isDevelopment()', () => {
		it('should return false when NODE_ENV is test', () => {
			expect(service.isDevelopment()).toBe(false)
		})

		it('should return true when NODE_ENV is dev', async () => {
			const devConfig = { ...mockConfig, NODE_ENV: 'dev' }
			mockNestConfigService.get.mockImplementation((key: string) => {
				if (key === '') return devConfig
				return devConfig[key as keyof typeof devConfig]
			})

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					ConfigService,
					{
						provide: NestConfigService,
						useValue: mockNestConfigService,
					},
				],
			}).compile()

			const devService = module.get<ConfigService>(ConfigService)
			expect(devService.isDevelopment()).toBe(true)
		})
	})

	describe('isProduction()', () => {
		it('should return false when NODE_ENV is test', () => {
			expect(service.isProduction()).toBe(false)
		})

		it('should return true when NODE_ENV is prod', async () => {
			const prodConfig = { ...mockConfig, NODE_ENV: 'prod' }
			mockNestConfigService.get.mockImplementation((key: string) => {
				if (key === '') return prodConfig
				return prodConfig[key as keyof typeof prodConfig]
			})

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					ConfigService,
					{
						provide: NestConfigService,
						useValue: mockNestConfigService,
					},
				],
			}).compile()

			const prodService = module.get<ConfigService>(ConfigService)
			expect(prodService.isProduction()).toBe(true)
		})
	})

	describe('isTest()', () => {
		it('should return true when NODE_ENV is test', () => {
			expect(service.isTest()).toBe(true)
		})

		it('should return false when NODE_ENV is dev', async () => {
			const devConfig = { ...mockConfig, NODE_ENV: 'dev' }
			mockNestConfigService.get.mockImplementation((key: string) => {
				if (key === '') return devConfig
				return devConfig[key as keyof typeof devConfig]
			})

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					ConfigService,
					{
						provide: NestConfigService,
						useValue: mockNestConfigService,
					},
				],
			}).compile()

			const devService = module.get<ConfigService>(ConfigService)
			expect(devService.isTest()).toBe(false)
		})
	})

	describe('buildConfig fallback', () => {
		it('should build config from individual keys when full config is not available', async () => {
			// Mock returning undefined for empty key to trigger fallback
			mockNestConfigService.get.mockImplementation((key: string) => {
				if (key === '') return undefined
				return mockConfig[key as keyof typeof mockConfig]
			})

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					ConfigService,
					{
						provide: NestConfigService,
						useValue: mockNestConfigService,
					},
				],
			}).compile()

			const fallbackService = module.get<ConfigService>(ConfigService)
			expect(fallbackService.get('PORT')).toBe(3000)
			expect(fallbackService.get('NODE_ENV')).toBe('test')
		})
	})
})
