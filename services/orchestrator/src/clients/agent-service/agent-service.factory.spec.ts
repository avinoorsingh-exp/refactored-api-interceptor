// services/orchestrator/src/clients/agent-service/agent-service.factory.spec.ts
import { AgentServiceClientFactory } from './agent-service.factory.js';
import { AgentServiceRestClient } from './agent-service.client.rest.js';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';

// Mock AgentServiceRestClient module
jest.mock('./agent-service.client.rest.js', () => ({
    AgentServiceRestClient: jest.fn(),
}));

describe('AgentServiceClientFactory', () => {
    let factory: AgentServiceClientFactory;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockLogger: jest.Mocked<LoggerService>;
    let mockRestClient: jest.Mocked<AgentServiceRestClient>;

    beforeEach(() => {
        mockRestClient = {
            proxy: jest.fn(),
            health: jest.fn(),
        } as any;

        (AgentServiceRestClient as jest.Mock).mockImplementation(() => mockRestClient);


        mockConfigService = {
            get: jest.fn(),
            getAll: jest.fn(),
            isDevelopment: jest.fn(),
            isProduction: jest.fn(),
            isTest: jest.fn(),
        } as any;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            getMetrics: jest.fn(),
        } as any;

        factory = new AgentServiceClientFactory(mockConfigService, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('get', () => {
        it('should create REST client with default config', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'rest';
                if (key === 'AGENT_SERVICE_URL') return 'http://agent-service:8090';
                if (key === 'S2S_INTERNAL_KEY') return 'test-s2s-key';
                return undefined;
            });

            const AgentServiceRestClientSpy = jest.spyOn(
                require('./agent-service.client.rest.js'),
                'AgentServiceRestClient',
            );

            const client = factory.get();

            expect(client).toBeDefined();
            expect(AgentServiceRestClientSpy).toHaveBeenCalledWith(
                'http://agent-service:8090',
                mockLogger,
                'test-s2s-key',
            );
        });

        it('should create REST client without S2S key when not configured', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'rest';
                if (key === 'AGENT_SERVICE_URL') return 'http://agent-service:8090';
                if (key === 'S2S_INTERNAL_KEY') return undefined;
                return undefined;
            });

            const AgentServiceRestClientSpy = jest.spyOn(
                require('./agent-service.client.rest.js'),
                'AgentServiceRestClient',
            );

            const client = factory.get();

            expect(client).toBeDefined();
            expect(AgentServiceRestClientSpy).toHaveBeenCalledWith(
                'http://agent-service:8090',
                mockLogger,
                undefined,
            );
        });

        it('should throw error when gRPC transport is requested', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'grpc';
                if (key === 'AGENT_SERVICE_URL') return 'http://agent-service:8090';
                return undefined;
            });

            expect(() => factory.get()).toThrow('gRPC transport not implemented yet for agent service');
        });

        it('should use REST as default when transport is not specified', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return undefined;
                if (key === 'AGENT_SERVICE_URL') return 'http://agent-service:8090';
                if (key === 'S2S_INTERNAL_KEY') return 'test-key';
                return undefined;
            });

            const AgentServiceRestClientSpy = jest.spyOn(
                require('./agent-service.client.rest.js'),
                'AgentServiceRestClient',
            );

            const client = factory.get();

            expect(client).toBeDefined();
            expect(AgentServiceRestClientSpy).toHaveBeenCalled();
        });
    });

    describe('getWithConfig', () => {
        it('should create client with custom endpoint', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'rest';
                if (key === 'AGENT_SERVICE_URL') return 'http://default:8090';
                if (key === 'S2S_INTERNAL_KEY') return 'default-key';
                return undefined;
            });

            const AgentServiceRestClientSpy = jest.spyOn(
                require('./agent-service.client.rest.js'),
                'AgentServiceRestClient',
            );

            const client = factory.getWithConfig({
                endpoint: 'http://custom:8090',
            });

            expect(client).toBeDefined();
            expect(AgentServiceRestClientSpy).toHaveBeenCalledWith(
                'http://custom:8090',
                mockLogger,
                'default-key',
            );
        });

        it('should create client with custom transport', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'rest';
                if (key === 'AGENT_SERVICE_URL') return 'http://agent-service:8090';
                if (key === 'S2S_INTERNAL_KEY') return 'default-key';
                return undefined;
            });

            expect(() => {
                factory.getWithConfig({
                    transport: 'grpc',
                });
            }).toThrow('gRPC transport not implemented yet');
        });

        it('should create client with custom S2S key', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'rest';
                if (key === 'AGENT_SERVICE_URL') return 'http://agent-service:8090';
                if (key === 'S2S_INTERNAL_KEY') return 'default-key';
                return undefined;
            });

            const AgentServiceRestClientSpy = jest.spyOn(
                require('./agent-service.client.rest.js'),
                'AgentServiceRestClient',
            );

            const client = factory.getWithConfig({
                s2sKey: 'custom-s2s-key',
            });

            expect(client).toBeDefined();
            expect(AgentServiceRestClientSpy).toHaveBeenCalledWith(
                'http://agent-service:8090',
                mockLogger,
                'custom-s2s-key',
            );
        });

        it('should create client with all custom config overrides', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'rest';
                if (key === 'AGENT_SERVICE_URL') return 'http://default:8090';
                if (key === 'S2S_INTERNAL_KEY') return 'default-key';
                return undefined;
            });

            const AgentServiceRestClientSpy = jest.spyOn(
                require('./agent-service.client.rest.js'),
                'AgentServiceRestClient',
            );

            const client = factory.getWithConfig({
                endpoint: 'http://custom:8090',
                transport: 'rest',
                s2sKey: 'custom-key',
            });

            expect(client).toBeDefined();
            expect(AgentServiceRestClientSpy).toHaveBeenCalledWith(
                'http://custom:8090',
                mockLogger,
                'custom-key',
            );
        });

        it('should fallback to config service values when overrides not provided', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                if (key === 'AGENT_SERVICE_TRANSPORT') return 'rest';
                if (key === 'AGENT_SERVICE_URL') return 'http://config-service:8090';
                if (key === 'S2S_INTERNAL_KEY') return 'config-key';
                return undefined;
            });

            const AgentServiceRestClientSpy = jest.spyOn(
                require('./agent-service.client.rest.js'),
                'AgentServiceRestClient',
            );

            const client = factory.getWithConfig({});

            expect(client).toBeDefined();
            expect(AgentServiceRestClientSpy).toHaveBeenCalledWith(
                'http://config-service:8090',
                mockLogger,
                'config-key',
            );
        });
    });
});