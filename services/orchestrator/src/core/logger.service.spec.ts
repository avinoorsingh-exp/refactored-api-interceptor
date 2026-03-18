// services/orchestrator/src/core/logger.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service.js';
import { ConfigService } from './config.service.js';
import { createLogger } from '@exprealty/logger';
import { MetricsService } from '@exprealty/logger/metrics';
import { ServiceCallEventSchema } from '@exprealty/shared-domain';

// Mock the logger package
jest.mock('@exprealty/logger', () => ({
  createLogger: jest.fn(),
}));

jest.mock('@exprealty/logger/metrics', () => ({
  MetricsService: jest.fn(),
}));

describe('LoggerService', () => {
  let service: LoggerService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockWinstonLogger: any;
  let mockMetricsService: jest.Mocked<MetricsService>;

  beforeEach(() => {
    mockWinstonLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockMetricsService = {
      recordHttpRequest: jest.fn(),
      recordHttpError: jest.fn(),
    } as any;

    (createLogger as jest.Mock).mockReturnValue(mockWinstonLogger);
    (MetricsService as jest.Mock).mockImplementation(() => mockMetricsService);

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          NODE_ENV: 'dev',
          LOG_LEVEL: 'info',
          LOG_DIR: '/var/log',
          METRICS_EXPORTER_ENDPOINT: 'http://metrics:9090',
          METRICS_EXPORTER_PROTOCOL: 'http',
          METRICS_EXPORT_INTERVAL_MS: 5000,
          METRICS_ENABLE_DIAGNOSTICS: false,
          METRICS_DIAGNOSTICS_VERBOSE: false,
          METRICS_EXPORTER_HEADERS: '{}',
        };
        return config[key];
      }),
      getAll: jest.fn(),
      isDevelopment: jest.fn(),
      isProduction: jest.fn(),
      isTest: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with correct configuration', () => {
      service = new LoggerService(mockConfigService);

      expect(createLogger).toHaveBeenCalledWith({
        service: 'orchestrator',
        level: 'info',
        logDir: '/var/log',
        env: 'dev',
      });
    });

    it('should initialize MetricsService with correct config', () => {
      service = new LoggerService(mockConfigService);

      expect(MetricsService).toHaveBeenCalledWith({
        service: 'orchestrator',
        version: '0.1.0',
        env: 'dev',
        exporterEndpoint: 'http://metrics:9090',
        exporterProtocol: 'http',
        exportIntervalMillis: 5000,
        exporterHeaders: {},
        enableDiagnostics: false,
        diagnosticsVerbose: false,
      });
    });

    it('should parse METRICS_EXPORTER_HEADERS JSON', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'METRICS_EXPORTER_HEADERS') {
          return '{"Authorization": "Bearer token123"}';
        }
        return undefined;
      });

      service = new LoggerService(mockConfigService);

      expect(MetricsService).toHaveBeenCalledWith(
        expect.objectContaining({
          exporterHeaders: { Authorization: 'Bearer token123' },
        }),
      );
    });

    it('should handle invalid METRICS_EXPORTER_HEADERS JSON', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'METRICS_EXPORTER_HEADERS') {
          return 'invalid-json';
        }
        if (key === 'NODE_ENV') return 'dev';
        if (key === 'LOG_LEVEL') return 'info';
        return undefined;
      });

      service = new LoggerService(mockConfigService);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        'Failed to parse METRICS_EXPORTER_HEADERS',
        expect.objectContaining({ error: expect.anything() }),
      );
    });

    it('should use default env when NODE_ENV not set', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return undefined;
        if (key === 'LOG_LEVEL') return 'info';
        return undefined;
      });

      service = new LoggerService(mockConfigService);

      expect(createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          env: 'dev',
        }),
      );
    });

    it('should use default log level when not set', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'dev';
        if (key === 'LOG_LEVEL') return undefined;
        return undefined;
      });

      service = new LoggerService(mockConfigService);

      expect(createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
        }),
      );
    });
  });

  describe('info', () => {
    beforeEach(() => {
      service = new LoggerService(mockConfigService);
    });

    it('should log info message', () => {
      service.info('Test message');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test message', undefined);
    });

    it('should log info message with metadata', () => {
      const meta = { userId: '123', action: 'login' };
      service.info('User logged in', meta);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('User logged in', meta);
    });
  });

  describe('error', () => {
    beforeEach(() => {
      service = new LoggerService(mockConfigService);
    });

    it('should log error message', () => {
      service.error('Error occurred');

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', undefined);
    });

    it('should log error message with metadata', () => {
      const meta = { error: 'Database connection failed', stack: 'stack trace' };
      service.error('Database error', meta);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Database error', meta);
    });
  });

  describe('warn', () => {
    beforeEach(() => {
      service = new LoggerService(mockConfigService);
    });

    it('should log warning message', () => {
      service.warn('Warning message');

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Warning message', undefined);
    });

    it('should log warning message with metadata', () => {
      const meta = { threshold: 80, current: 90 };
      service.warn('High usage', meta);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('High usage', meta);
    });
  });

  describe('debug', () => {
    beforeEach(() => {
      service = new LoggerService(mockConfigService);
    });

    it('should log debug message', () => {
      service.debug('Debug message');

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Debug message', undefined);
    });

    it('should log debug message with metadata', () => {
      const meta = { requestId: 'req-123', duration: 45 };
      service.debug('Request processed', meta);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Request processed', meta);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      service = new LoggerService(mockConfigService);
    });

    it('should return metrics service instance', () => {
      const metrics = service.getMetrics();

      expect(metrics).toBe(mockMetricsService);
    });
  });

  describe('serviceCall', () => {
    beforeEach(() => {
      service = new LoggerService(mockConfigService);
    });

    it('should log valid service call event', () => {
      const input = {
        serviceCall: 'agent:countries',
        endpoint: '/countries',
        method: 'GET' as const,
        status: 200,
        ok: true,
        duration_ms: 150,
        retries: 0,
      };

      service.serviceCall(input);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'provider_call',
        expect.objectContaining({
          event: 'service_call',
          service: 'orchestrator',
          env: 'dev',
          serviceCall: 'agent:countries',
          endpoint: '/countries',
          method: 'GET',
          status: 200,
          ok: true,
          duration_ms: 150,
          retries: 0,
        }),
      );
    });

    it('should log service call with all required fields', () => {
      const input = {
        serviceCall: 'notification:notifications',
        endpoint: '/notifications',
        method: 'POST' as const,
        status: 201,
        ok: true,
        duration_ms: 200,
        retries: 0,
        request_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      service.serviceCall(input);

      const callArgs = mockWinstonLogger.info.mock.calls[0];
      expect(callArgs[0]).toBe('provider_call');
      expect(callArgs[1]).toMatchObject({
        event: 'service_call',
        service: 'orchestrator',
        env: 'dev',
        serviceCall: 'notification:notifications',
        endpoint: '/notifications',
        method: 'POST',
        status: 201,
        ok: true,
        duration_ms: 200,
        retries: 0,
        request_id: '550e8400-e29b-41d4-a716-446655440000',
      });
    });

    it('should warn and not log invalid service call event', () => {
      const input = {
        serviceCall: 'agent:countries',
        endpoint: '/countries',
        method: 'INVALID_METHOD' as any, // Invalid HTTP method
        status: 200,
        ok: true,
        duration_ms: 150,
        retries: 0,
      };

      // Mock ServiceCallEventSchema to return failure
      const originalSafeParse = ServiceCallEventSchema.safeParse;
      jest.spyOn(ServiceCallEventSchema, 'safeParse').mockReturnValue({
        success: false,
        error: {
          format: jest.fn().mockReturnValue({}),
        },
      } as any);

      service.serviceCall(input);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        'provider_call_invalid',
        expect.objectContaining({
          issues: expect.anything(),
          raw: input,
        }),
      );
      expect(mockWinstonLogger.info).not.toHaveBeenCalledWith('provider_call', expect.anything());

      // Restore
      jest.spyOn(ServiceCallEventSchema, 'safeParse').mockImplementation(originalSafeParse);
    });

    it('should handle missing optional fields', () => {
      const input = {
        serviceCall: 'agent:health',
        endpoint: '/health',
        method: 'GET' as const,
        status: 200,
        ok: true,
        duration_ms: 50,
        retries: 0,
      };

      service.serviceCall(input);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'provider_call',
        expect.objectContaining({
          serviceCall: 'agent:health',
          endpoint: '/health',
          method: 'GET',
          status: 200,
          ok: true,
          duration_ms: 50,
          retries: 0,
        }),
      );
    });

    it('should include correlation ID when provided', () => {
      const input = {
        serviceCall: 'agent:countries',
        endpoint: '/countries',
        method: 'GET' as const,
        status: 200,
        ok: true,
        duration_ms: 150,
        retries: 0,
        request_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      service.serviceCall(input);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'provider_call',
        expect.objectContaining({
          request_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      );
    });
  });
});