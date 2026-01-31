// services/orchestrator/src/clients/agent-service/agent-service.client.rest.spec.ts
import { AgentServiceRestClient } from './agent-service.client.rest.js';
import { EcsHttpClient } from '../../common/ecs-http-client.js';
import { LoggerService } from '../../core/logger.service.js';
import { AxiosError } from 'axios';

// Mock EcsHttpClient module
jest.mock('../../common/ecs-http-client.js', () => ({
    EcsHttpClient: jest.fn(),
}));

describe('AgentServiceRestClient', () => {
    let client: AgentServiceRestClient;
    let mockEcsHttpClient: jest.Mocked<EcsHttpClient>;
    let mockLogger: jest.Mocked<LoggerService>;
    let mockRequest: jest.MockedFunction<any>;
    const baseUrl = 'http://agent-service:8090';
    const s2sKey = 'test-s2s-key';

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            getMetrics: jest.fn(),
        } as any;

        mockRequest = jest.fn() as jest.MockedFunction<any>;
        mockEcsHttpClient = {
            instance: {
                request: mockRequest,
            } as any,
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
        } as any;

        // Mock EcsHttpClient constructor by creating client directly
        // We'll need to spy on EcsHttpClient constructor
        (EcsHttpClient as jest.Mock).mockImplementation(() => mockEcsHttpClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create client with S2S key', () => {
            client = new AgentServiceRestClient(baseUrl, mockLogger, s2sKey);
            expect(client).toBeDefined();
            expect(EcsHttpClient).toHaveBeenCalled();
        });

        it('should create client without S2S key', () => {
            client = new AgentServiceRestClient(baseUrl, mockLogger);
            expect(client).toBeDefined();
            expect(EcsHttpClient).toHaveBeenCalled();
        });


        it('should configure client with 60s timeout', () => {
            client = new AgentServiceRestClient(baseUrl, mockLogger, s2sKey);

            expect(EcsHttpClient).toHaveBeenCalledWith(
                mockLogger,
                { service: 'agent-service' },
                expect.objectContaining({
                    baseURL: baseUrl,
                    timeout: 60_000,
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'x-internal-auth': s2sKey,
                    }),
                }),
            );
        });

        it('should not include S2S key header when not provided', () => {
            client = new AgentServiceRestClient(baseUrl, mockLogger);

            expect(EcsHttpClient).toHaveBeenCalledWith(
                mockLogger,
                { service: 'agent-service' },
                expect.objectContaining({
                    headers: expect.not.objectContaining({
                        'x-internal-auth': expect.anything(),
                    }),
                }),
            );
        });
    });

    describe('proxy', () => {
        beforeEach(() => {
            client = new AgentServiceRestClient(baseUrl, mockLogger, s2sKey);
            // Override the http property for testing
            (client as any).http = mockEcsHttpClient;
        });

        it('should proxy GET request successfully', async () => {
            const mockResponse = {
                status: 200,
                data: { id: '123', name: 'Test' },
                headers: { 'content-type': 'application/json' },
            };

            mockRequest.mockResolvedValue(mockResponse);

            const result = await client.proxy({
                method: 'GET',
                path: '/v1/countries',
                query: { limit: 10 },
                headers: { 'accept': 'application/json' },
            });

            expect(result).toEqual({
                status: 200,
                data: { id: '123', name: 'Test' },
                headers: { 'content-type': 'application/json' },
            });

            expect(mockRequest).toHaveBeenCalledWith({
                method: 'GET',
                url: '/v1/countries',
                data: undefined,
                params: { limit: 10 },
                headers: { 'accept': 'application/json' },
            });
        });

        it('should proxy POST request with body', async () => {
            const mockResponse = {
                status: 201,
                data: { id: '456', created: true },
                headers: {},
            };

            mockRequest.mockResolvedValue(mockResponse);

            const requestBody = { name: 'New Country', code: 'NC' };
            const result = await client.proxy({
                method: 'POST',
                path: '/v1/countries',
                body: requestBody,
            });

            expect(result.status).toBe(201);
            expect(result.data).toEqual({ id: '456', created: true });
            expect(mockRequest).toHaveBeenCalledWith({
                method: 'POST',
                url: '/v1/countries',
                data: requestBody,
                params: undefined,
                headers: undefined,
            });
        });

        it('should proxy PUT request', async () => {
            const mockResponse = {
                status: 200,
                data: { id: '123', updated: true },
                headers: {},
            };

            mockRequest.mockResolvedValue(mockResponse);

            const result = await client.proxy({
                method: 'PUT',
                path: '/v1/countries/123',
                body: { name: 'Updated' },
            });

            expect(result.status).toBe(200);
        });

        it('should proxy PATCH request', async () => {
            const mockResponse = {
                status: 200,
                data: { id: '123', patched: true },
                headers: {},
            };

            mockRequest.mockResolvedValue(mockResponse);

            const result = await client.proxy({
                method: 'PATCH',
                path: '/v1/countries/123',
                body: { name: 'Patched' },
            });

            expect(result.status).toBe(200);
        });

        it('should proxy DELETE request', async () => {
            const mockResponse = {
                status: 204,
                data: null,
                headers: {},
            };

            mockRequest.mockResolvedValue(mockResponse);

            const result = await client.proxy({
                method: 'DELETE',
                path: '/v1/countries/123',
            });

            expect(result.status).toBe(204);
        });

        it('should return error response when upstream returns error status', async () => {
            const mockErrorResponse = {
                status: 404,
                data: { type: 'NotFound', detail: 'Resource not found' },
                headers: {},
            };

            const axiosError = new AxiosError('Not Found');
            axiosError.response = mockErrorResponse as any;
            axiosError.config = {} as any;

            mockRequest.mockRejectedValue(axiosError);

            const result = await client.proxy({
                method: 'GET',
                path: '/v1/countries/999',
            });

            expect(result.status).toBe(404);
            expect(result.data).toEqual({ type: 'NotFound', detail: 'Resource not found' });
        });

        it('should return error response for 400 status', async () => {
            const mockErrorResponse = {
                status: 400,
                data: { type: 'ValidationError', detail: 'Invalid input' },
                headers: {},
            };

            const axiosError = new AxiosError('Bad Request');
            axiosError.response = mockErrorResponse as any;
            axiosError.config = {} as any;

            mockRequest.mockRejectedValue(axiosError);

            const result = await client.proxy({
                method: 'POST',
                path: '/v1/countries',
                body: { invalid: 'data' },
            });

            expect(result.status).toBe(400);
        });

        it('should throw error when network error occurs (no response)', async () => {
            const networkError = new AxiosError('Network Error');
            networkError.code = 'ECONNREFUSED';
            networkError.config = {} as any;

            mockRequest.mockRejectedValue(networkError);

            await expect(
                client.proxy({
                    method: 'GET',
                    path: '/v1/countries',
                }),
            ).rejects.toThrow('Network Error');
        });

        it('should throw error on timeout', async () => {
            const timeoutError = new AxiosError('timeout of 60000ms exceeded');
            timeoutError.code = 'ECONNABORTED';
            timeoutError.config = {} as any;

            mockRequest.mockRejectedValue(timeoutError);

            await expect(
                client.proxy({
                    method: 'GET',
                    path: '/v1/countries',
                }),
            ).rejects.toThrow('timeout of 60000ms exceeded');
        });

        it('should forward all query parameters', async () => {
            const mockResponse = {
                status: 200,
                data: [],
                headers: {},
            };

            mockRequest.mockResolvedValue(mockResponse);

            await client.proxy({
                method: 'GET',
                path: '/v1/countries',
                query: {
                    offset: '0',
                    limit: '25',
                    sort: 'name',
                    filter: 'active',
                },
            });

            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: {
                        offset: '0',
                        limit: '25',
                        sort: 'name',
                        filter: 'active',
                    },
                }),
            );
        });

        it('should forward all headers', async () => {
            const mockResponse = {
                status: 200,
                data: [],
                headers: {},
            };

            mockRequest.mockResolvedValue(mockResponse);

            await client.proxy({
                method: 'GET',
                path: '/v1/countries',
                headers: {
                    'authorization': 'Bearer token123',
                    'accept': 'application/json',
                    'x-custom-header': 'custom-value',
                },
            });

            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: {
                        'authorization': 'Bearer token123',
                        'accept': 'application/json',
                        'x-custom-header': 'custom-value',
                    },
                }),
            );
        });
    });

    describe('health', () => {
        beforeEach(() => {
            client = new AgentServiceRestClient(baseUrl, mockLogger, s2sKey);
            (client as any).http = mockEcsHttpClient;
        });

        it('should call health endpoint successfully', async () => {
            const mockHealthResponse = { status: 'ok' };
            mockEcsHttpClient.get.mockResolvedValue(mockHealthResponse);

            const result = await client.health();

            expect(result).toEqual({ status: 'ok' });
            expect(mockEcsHttpClient.get).toHaveBeenCalledWith('/health');
        });

        it('should handle health check errors', async () => {
            const healthError = new AxiosError('Service Unavailable');
            healthError.response = { status: 503 } as any;
            healthError.config = {} as any;

            mockEcsHttpClient.get.mockRejectedValue(healthError);

            await expect(client.health()).rejects.toThrow('Service Unavailable');
        });
    });
});