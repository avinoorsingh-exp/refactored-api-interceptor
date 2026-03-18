// services/orchestrator/src/core/config.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigService as OrchestratorConfigService } from './config.service.js';
import type { Config } from './configuration.js';

describe('ConfigService', () => {
  let service: OrchestratorConfigService;
  let nestConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    nestConfigService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorConfigService,
        {
          provide: ConfigService,
          useValue: nestConfigService,
        },
      ],
    }).compile();

    service = module.get<OrchestratorConfigService>(OrchestratorConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config from NestConfigService', () => {
      const mockConfig: Config = {
        NODE_ENV: 'dev',
        PORT: 3000,
        LOG_LEVEL: 'info',
        LOG_DIR: '/var/log',
        AWS_REGION: 'us-east-1',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        S2S_INTERNAL_KEY: 'test-key',
        METRICS_EXPORTER_ENDPOINT: 'http://metrics:9090',
        METRICS_EXPORTER_PROTOCOL: 'http',
        METRICS_EXPORT_INTERVAL_MS: 5000,
        METRICS_ENABLE_DIAGNOSTICS: true,
        METRICS_DIAGNOSTICS_VERBOSE: false,
        METRICS_EXPORTER_HEADERS: '{}',
        AGENT_SERVICE_URL: 'http://agent-service:8090',
        AGENT_SERVICE_TRANSPORT: 'rest',
      };

      nestConfigService.get.mockReturnValue(mockConfig);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.get('NODE_ENV')).toBe('dev');
      expect(newService.get('PORT')).toBe(3000);
    });

    it('should fallback to buildConfig when full config not available', () => {
      nestConfigService.get.mockImplementation((key: string) => {
        if (key === '') return undefined; // Full config not available
        if (key === 'NODE_ENV') return 'prod';
        if (key === 'PORT') return '8080';
        return undefined;
      });

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.get('NODE_ENV')).toBe('prod');
      expect(newService.get('PORT')).toBe('8080');
    });
  });

  describe('get', () => {
    it('should return config value for valid key', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'dev',
        PORT: '3000',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);
      const value = newService.get('NODE_ENV');

      expect(value).toBe('dev');
    });

    it('should return undefined for non-existent key', () => {
      nestConfigService.get.mockReturnValue({} as any);

      const newService = new OrchestratorConfigService(nestConfigService);
      const value = newService.get('NON_EXISTENT_KEY' as any);

      expect(value).toBeUndefined();
    });

    it('should return all config keys correctly', () => {
      const mockConfig: Partial<Config> = {
        NODE_ENV: 'dev',
        PORT: 3000,
        LOG_LEVEL: 'debug',
        AGENT_SERVICE_URL: 'http://agent:8090',
      };

      nestConfigService.get.mockReturnValue(mockConfig as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.get('NODE_ENV')).toBe('dev');
      expect(newService.get('PORT')).toBe(3000);
      expect(newService.get('LOG_LEVEL')).toBe('debug');
      expect(newService.get('AGENT_SERVICE_URL')).toBe('http://agent:8090');
    });
  });

  describe('getAll', () => {
    it('should return complete config object', () => {
      const mockConfig: Config = {
        NODE_ENV: 'prod',
        PORT: 8080,
        LOG_LEVEL: 'info',
        LOG_DIR: '/var/log',
        AWS_REGION: 'us-east-1',
        ALLOWED_ORIGINS: '*',
        S2S_INTERNAL_KEY: 'prod-key',
        METRICS_EXPORTER_ENDPOINT: 'http://metrics:9090',
        METRICS_EXPORTER_PROTOCOL: 'http',
        METRICS_EXPORT_INTERVAL_MS: 10000,
        METRICS_ENABLE_DIAGNOSTICS: false,
        METRICS_DIAGNOSTICS_VERBOSE: false,
        METRICS_EXPORTER_HEADERS: '{}',
        AGENT_SERVICE_URL: 'http://agent-service:8090',
        AGENT_SERVICE_TRANSPORT: 'rest',
      };

      nestConfigService.get.mockReturnValue(mockConfig);

      const newService = new OrchestratorConfigService(nestConfigService);
      const allConfig = newService.getAll();

      expect(allConfig).toEqual(mockConfig);
    });

    it('should return cached config object', () => {
      const mockConfig: Partial<Config> = {
        NODE_ENV: 'dev',
        PORT: 3000,
      };

      nestConfigService.get.mockReturnValue(mockConfig as any);

      const newService = new OrchestratorConfigService(nestConfigService);
      const config1 = newService.getAll();
      const config2 = newService.getAll();

      expect(config1).toBe(config2); // Same reference (cached)
    });
  });

  describe('isDevelopment', () => {
    it('should return true when NODE_ENV is dev', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'dev',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.isDevelopment()).toBe(true);
    });

    it('should return false when NODE_ENV is not dev', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'prod',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.isDevelopment()).toBe(false);
    });

    it('should return false when NODE_ENV is test', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'test',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.isDevelopment()).toBe(false);
    });
  });

  describe('isProduction', () => {
    it('should return true when NODE_ENV is prod', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'prod',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.isProduction()).toBe(true);
    });

    it('should return false when NODE_ENV is not prod', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'dev',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.isProduction()).toBe(false);
    });
  });

  describe('isTest', () => {
    it('should return true when NODE_ENV is test', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'test',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.isTest()).toBe(true);
    });

    it('should return false when NODE_ENV is not test', () => {
      nestConfigService.get.mockReturnValue({
        NODE_ENV: 'dev',
      } as any);

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.isTest()).toBe(false);
    });
  });

  describe('buildConfig fallback', () => {
    it('should build config from individual keys when full config unavailable', () => {
      nestConfigService.get.mockImplementation((key: string) => {
        if (key === '') return undefined;
        if (key === 'NODE_ENV') return 'dev';
        if (key === 'PORT') return '3000';
        if (key === 'LOG_LEVEL') return 'info';
        if (key === 'AGENT_SERVICE_URL') return 'http://agent:8090';
        return undefined;
      });

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.get('NODE_ENV')).toBe('dev');
      expect(newService.get('PORT')).toBe('3000');
      expect(newService.get('LOG_LEVEL')).toBe('info');
      expect(newService.get('AGENT_SERVICE_URL')).toBe('http://agent:8090');
    });

    it('should handle missing optional config values', () => {
      nestConfigService.get.mockImplementation((key: string) => {
        if (key === '') return undefined;
        if (key === 'NODE_ENV') return 'dev';
        return undefined; // All other keys missing
      });

      const newService = new OrchestratorConfigService(nestConfigService);

      expect(newService.get('NODE_ENV')).toBe('dev');
      expect(newService.get('PORT')).toBeUndefined();
      expect(newService.get('LOG_LEVEL')).toBeUndefined();
    });
  });
});