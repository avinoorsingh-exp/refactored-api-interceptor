// services/orchestrator/src/controllers/agent-service.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { AgentServiceController } from './agent-service.controller.js';
import { AgentServiceClientFactory } from '../clients/agent-service/agent-service.factory.js';
import { AgentServiceClient, type ProxyResponse } from '../clients/agent-service/agent-service.client.js';
import { LoggerService } from '../core/logger.service.js';
import { AxiosError } from 'axios';
import { HttpStatus } from '@nestjs/common';
import { ProblemTypes, ProblemTitles } from '@exprealty/shared-domain';

describe('AgentServiceController', () => {
    let controller: AgentServiceController;
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
            path: '/v1/countries',
            body: {},
            query: {},
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json',
                'host': 'localhost:3000',
            },
            protocol: 'http',
        } as any;

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            setHeader: jest.fn().mockReturnThis(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AgentServiceController],
            providers: [
                { provide: AgentServiceClientFactory, useValue: mockFactory },
                { provide: LoggerService, useValue: mockLogger },
            ],
        }).compile();

        controller = module.get<AgentServiceController>(AgentServiceController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('proxyToAgentService', () => {
        it('should proxy GET request successfully', async () => {
            const mockProxyResponse = {
                status: 200,
                data: { items: [], total: 0 },
                headers: { 'content-type': 'application/json' },
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockFactory.get).toHaveBeenCalled();
            expect(mockClient.proxy).toHaveBeenCalledWith({
                method: 'GET',
                path: '/v1/countries',
                body: {},
                query: {},
                headers: expect.objectContaining({
                    'content-type': 'application/json',
                    'accept': 'application/json',
                }),
            });
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ items: [], total: 0 });
            expect(mockResponse.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
            expect(mockLogger.info).toHaveBeenCalledWith('Agent service request', expect.any(Object));
            expect(mockLogger.info).toHaveBeenCalledWith('Agent service request succeeded', expect.any(Object));
        });

        it('should proxy POST request with body', async () => {
            const postRequest = {
                ...mockRequest,
                method: 'POST',
                path: '/v1/countries',
                body: { name: 'Test Country', code: 'TC' },
            } as Request;

            const mockProxyResponse = {
                status: 201,
                data: { id: '123', name: 'Test Country' },
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                postRequest,
                mockResponse as Response,
            );

            expect(mockClient.proxy).toHaveBeenCalledWith({
                method: 'POST',
                path: '/v1/countries',
                body: { name: 'Test Country', code: 'TC' },
                query: {},
                headers: expect.any(Object),
            });
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith({ id: '123', name: 'Test Country' });
        });

        it('should proxy PUT request', async () => {
            const putRequest = {
                ...mockRequest,
                method: 'PUT',
                path: '/v1/countries/123',
                body: { name: 'Updated Country' },
            } as Request;

            const mockProxyResponse = {
                status: 200,
                data: { id: '123', name: 'Updated Country' },
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                putRequest,
                mockResponse as Response,
            );

            expect(mockClient.proxy).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'PUT',
                    path: '/v1/countries/123',
                }),
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should proxy DELETE request', async () => {
            const deleteRequest = {
                ...mockRequest,
                method: 'DELETE',
                path: '/v1/countries/123',
            } as Request;

            const mockProxyResponse = {
                status: 204,
                data: null,
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                deleteRequest,
                mockResponse as Response,
            );

            expect(mockClient.proxy).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'DELETE',
                }),
            );
            expect(mockResponse.status).toHaveBeenCalledWith(204);
        });

        it('should forward query parameters', async () => {
            mockRequest.query = { offset: '0', limit: '25', sort: 'name' };

            const mockProxyResponse = {
                status: 200,
                data: [],
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockClient.proxy).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: { offset: '0', limit: '25', sort: 'name' },
                }),
            );
        });

        it('should forward authorization header', async () => {
            mockRequest.headers = {
                ...mockRequest.headers,
                'authorization': 'Bearer token123',
            } as any;

            const mockProxyResponse = {
                status: 200,
                data: [],
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockClient.proxy).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'authorization': 'Bearer token123',
                    }),
                }),
            );
        });

        it('should set x-forwarded-host and x-forwarded-proto headers', async () => {
            const mockProxyResponse = {
                status: 200,
                data: [],
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockClient.proxy).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'x-forwarded-host': 'localhost:3000',
                        'x-forwarded-proto': 'http',
                    }),
                }),
            );
        });

        it('should forward response headers', async () => {
            const mockProxyResponse = {
                status: 200,
                data: [],
                headers: {
                    'content-type': 'application/json',
                    'x-total-count': '100',
                    'link': '</v1/countries?offset=25>; rel="next"',
                },
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockResponse.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('x-total-count', '100');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('link', '</v1/countries?offset=25>; rel="next"');
        });

        it('should handle AxiosError with response', async () => {
            const axiosError = new AxiosError('Bad Gateway');
            axiosError.response = {
                status: 502,
                data: {
                    type: ProblemTypes.BadGateway, // The response data already has BadGateway type
                    title: ProblemTitles[ProblemTypes.BadGateway],
                    status: 502,
                    detail: 'Service unavailable',
                },
            } as any;
            axiosError.config = {} as any;

            mockClient.proxy.mockRejectedValue(axiosError);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(502);
            // The controller uses error.response.data directly, so it keeps the BadGateway type
            // It doesn't add instance field - it uses the data as-is
            expect(mockResponse.json).toHaveBeenCalledWith({
                type: ProblemTypes.BadGateway, // Changed from Upstream
                title: ProblemTitles[ProblemTypes.BadGateway],
                status: 502,
                detail: 'Service unavailable',
                // Note: instance is NOT added by controller when response.data exists
            });
            expect(mockLogger.error).toHaveBeenCalledWith('Agent service request failed', expect.any(Object));
        });

        it('should handle AxiosError without response (network error)', async () => {
            const axiosError = new AxiosError('Network Error');
            axiosError.code = 'ECONNREFUSED';
            axiosError.config = {} as any;

            mockClient.proxy.mockRejectedValue(axiosError);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
            expect(mockResponse.json).toHaveBeenCalledWith({
                type: ProblemTypes.Upstream,
                title: ProblemTitles[ProblemTypes.Upstream],
                status: HttpStatus.BAD_GATEWAY,
                detail: 'Network Error',
                instance: '/v1/countries',
            });
        });

        it('should return 504 when upstream times out (ECONNABORTED with upstreamProblem)', async () => {
            const axiosError = new AxiosError('timeout of 60000ms exceeded');
            axiosError.code = 'ECONNABORTED';
            axiosError.config = {} as any;
            const upstreamProblem = {
                type: ProblemTypes.Timeout,
                title: 'Gateway Timeout',
                status: 504,
                detail: 'timeout of 60000ms exceeded',
                instance: '/v1/agents',
            };
            Object.defineProperty(axiosError, 'upstreamProblem', { value: upstreamProblem, enumerable: true });

            mockClient.proxy.mockRejectedValue(axiosError);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(504);
            expect(mockResponse.json).toHaveBeenCalledWith(upstreamProblem);
        });

        it('should handle generic error', async () => {
            const genericError = new Error('Unexpected error');
            mockClient.proxy.mockRejectedValue(genericError);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
            expect(mockResponse.json).toHaveBeenCalledWith({
                type: ProblemTypes.Internal,
                title: ProblemTitles[ProblemTypes.Internal],
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                detail: 'Unexpected error',
                instance: '/v1/countries',
            });
            expect(mockLogger.error).toHaveBeenCalledWith('Agent service request failed', expect.any(Object));
        });

        it('should log request duration', async () => {
            const mockProxyResponse = {
                status: 200,
                data: [],
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Agent service request succeeded',
                expect.objectContaining({
                    duration_ms: expect.any(Number),
                }),
            );
        });

        it('should handle array headers correctly', async () => {
            mockRequest.headers = {
                'x-forwarded-host': ['proxy.example.com', 'localhost:3000'],
                'x-forwarded-proto': ['https'],
            } as any;

            const mockProxyResponse = {
                status: 200,
                data: [],
                headers: {},
            };

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockClient.proxy).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'x-forwarded-host': 'proxy.example.com',
                        'x-forwarded-proto': 'https',
                    }),
                }),
            );
        });

        it('should not forward undefined headers', async () => {
            const mockProxyResponse = {
                status: 200,
                data: [],
                headers: {
                    'valid-header': 'value',
                    'undefined-header': undefined,
                },
            } as unknown as ProxyResponse;

            mockClient.proxy.mockResolvedValue(mockProxyResponse);

            await controller.proxyToAgentService(
                mockRequest as Request,
                mockResponse as Response,
            );

            expect(mockResponse.setHeader).toHaveBeenCalledWith('valid-header', 'value');
            expect(mockResponse.setHeader).not.toHaveBeenCalledWith('undefined-header', expect.anything());
        });
    });

    describe('agentHealth', () => {
        it('should return agent service proxy health status', async () => {
            const result = await controller.agentHealth();

            expect(result).toEqual({
                status: 'ok',
                service: 'agent-service-proxy',
            });
        });
    });
});