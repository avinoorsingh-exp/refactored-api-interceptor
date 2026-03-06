// services/orchestrator/src/controllers/swagger-proxy.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { SwaggerProxyController } from './swagger-proxy.controller.js';
import { AgentServiceClientFactory } from '../clients/agent-service/agent-service.factory.js';
import { AgentServiceClient } from '../clients/agent-service/agent-service.client.js';
import { LoggerService } from '../core/logger.service.js';
import { AxiosError } from 'axios';
import { HttpStatus } from '@nestjs/common';

describe('SwaggerProxyController', () => {
  let controller: SwaggerProxyController;
  let mockFactory: jest.Mocked<AgentServiceClientFactory>;
  let mockClient: jest.Mocked<AgentServiceClient>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockClient = {
      proxy: jest.fn(),
      health: jest.fn(),
    } as any;

    mockFactory = {
      get: jest.fn().mockReturnValue(mockClient),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    mockRequest = {
      method: 'GET',
      path: '/api',
      url: '/api',
      query: {},
      headers: {},
      body: {},
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SwaggerProxyController],
      providers: [
        { provide: AgentServiceClientFactory, useValue: mockFactory },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get<SwaggerProxyController>(SwaggerProxyController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('proxySwagger', () => {
    it('should proxy GET request to /api successfully', async () => {
      const mockProxyResponse = {
        status: 200,
        data: '<html>Swagger UI</html>',
        headers: { 'content-type': 'text/html' },
      };

      mockClient.proxy.mockResolvedValue(mockProxyResponse);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockFactory.get).toHaveBeenCalled();
      expect(mockClient.proxy).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api',
        query: {},
        headers: {},
        body: {},
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith('<html>Swagger UI</html>');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('content-type', 'text/html');
      expect(mockLogger.debug).toHaveBeenCalledWith('Swagger proxy request', expect.any(Object));
    });

    it('should proxy request to /api/swagger.json', async () => {
      const swaggerRequest = {
        ...mockRequest,
        path: '/api/swagger.json',
        url: '/api/swagger.json',
      } as Request;

      const mockProxyResponse = {
        status: 200,
        data: { openapi: '3.0.0', paths: {} },
        headers: { 'content-type': 'application/json' },
      };

      mockClient.proxy.mockResolvedValue(mockProxyResponse);

      await controller.proxySwagger(
        swaggerRequest,
        mockResponse as Response,
      );

      expect(mockClient.proxy).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/swagger.json',
        query: {},
        headers: {},
        body: {},
      });
      expect(mockResponse.send).toHaveBeenCalledWith({ openapi: '3.0.0', paths: {} });
    });

    it('should proxy request with query parameters', async () => {
      mockRequest.query = { version: '1.0', format: 'json' };

      const mockProxyResponse = {
        status: 200,
        data: {},
        headers: {},
      };

      mockClient.proxy.mockResolvedValue(mockProxyResponse);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockClient.proxy).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { version: '1.0', format: 'json' },
        }),
      );
    });

    it('should forward request headers', async () => {
      mockRequest.headers = {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
      } as any;

      const mockProxyResponse = {
        status: 200,
        data: {},
        headers: {},
      };

      mockClient.proxy.mockResolvedValue(mockProxyResponse);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockClient.proxy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0',
          }),
        }),
      );
    });

    it('should forward response headers', async () => {
      const mockProxyResponse = {
        status: 200,
        data: {},
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-cache',
          'x-swagger-version': '3.0.0',
        },
      };

      mockClient.proxy.mockResolvedValue(mockProxyResponse);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('cache-control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-swagger-version', '3.0.0');
    });

    it('should handle AxiosError with response', async () => {
      const axiosError = new AxiosError('Not Found');
      axiosError.response = {
        status: 404,
        data: { message: 'Swagger not found' },
      } as any;
      axiosError.config = {} as any;

      mockClient.proxy.mockRejectedValue(axiosError);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        type: 'https://httpstatuses.io/502',
        title: 'Bad Gateway',
        status: HttpStatus.BAD_GATEWAY,
        detail: 'Failed to proxy Swagger documentation from agent-service',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Swagger proxy error', expect.any(Object));
    });

    it('should handle AxiosError without response (network error)', async () => {
      const axiosError = new AxiosError('Network Error');
      axiosError.code = 'ECONNREFUSED';
      axiosError.config = {} as any;

      mockClient.proxy.mockRejectedValue(axiosError);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
      expect(mockLogger.error).toHaveBeenCalledWith('Swagger proxy error', expect.any(Object));
    });

    it('should handle generic error', async () => {
      const genericError = new Error('Unexpected error');
      mockClient.proxy.mockRejectedValue(genericError);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        type: 'https://httpstatuses.io/500',
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'An unexpected error occurred while proxying Swagger documentation',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Unexpected swagger proxy error', expect.any(Object));
    });

    it('should log original URL and path', async () => {
      const logRequest = {
        ...mockRequest,
        url: '/api/swagger.json?version=2.0',
        path: '/api/swagger.json',
      } as Request;

      const mockProxyResponse = {
        status: 200,
        data: {},
        headers: {},
      };

      mockClient.proxy.mockResolvedValue(mockProxyResponse);

      await controller.proxySwagger(
        logRequest,
        mockResponse as Response,
      );

      expect(mockLogger.debug).toHaveBeenCalledWith('Swagger proxy request', {
        originalUrl: '/api/swagger.json?version=2.0',
        path: '/api/swagger.json',
        method: 'GET',
      });
    });

    it('should handle POST request to Swagger', async () => {
      mockRequest.method = 'POST';
      mockRequest.body = { action: 'validate' };

      const mockProxyResponse = {
        status: 200,
        data: { valid: true },
        headers: {},
      };

      mockClient.proxy.mockResolvedValue(mockProxyResponse);

      await controller.proxySwagger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockClient.proxy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          body: { action: 'validate' },
        }),
      );
    });
  });
});