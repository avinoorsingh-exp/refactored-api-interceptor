import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaBootstrapService } from './kafka-bootstrap.service.js';
import { KafkaRuntimeManager } from './kafka-runtime-manager.service.js';
import { EnterpriseAgentUpdatedConsumer } from './consumers/enterprise-agent-updated.consumer.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { KafkaServiceEntity, KafkaServiceType } from '@exprealty/database';

describe('KafkaBootstrapService', () => {
	let service: KafkaBootstrapService;
	let mockKafkaServiceRepo: jest.Mocked<Repository<KafkaServiceEntity>>;
	let mockKafkaRuntimeManager: jest.Mocked<KafkaRuntimeManager>;
	let mockEnterpriseAgentUpdatedConsumer: jest.Mocked<EnterpriseAgentUpdatedConsumer>;
	let mockKafkaProducerService: jest.Mocked<KafkaProducerService>;
	let mockConfigService: jest.Mocked<ConfigService>;
	let mockLogger: jest.Mocked<LoggerService>;

	const createMockEntity = (overrides?: Partial<KafkaServiceEntity>): KafkaServiceEntity => ({
		id: '123e4567-e89b-12d3-a456-426614174000',
		type: KafkaServiceType.CONSUMER,
		topic: 'Enterprise_AgentUpdated_V2',
		groupId: 'agent-service-group',
		enabled: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	const createMockService = () => ({
		getId: jest.fn().mockReturnValue('consumer-Enterprise_AgentUpdated_V2-agent-service-group'),
		getType: jest.fn().mockReturnValue('consumer'),
		getTopic: jest.fn().mockReturnValue('Enterprise_AgentUpdated_V2'),
		getGroupId: jest.fn().mockReturnValue('agent-service-group'),
		start: jest.fn().mockResolvedValue({}),
		stop: jest.fn().mockResolvedValue(undefined),
	});

	beforeEach(async () => {
		mockKafkaServiceRepo = {
			find: jest.fn(),
		} as any;

		mockKafkaRuntimeManager = {
			register: jest.fn(),
			start: jest.fn().mockResolvedValue(undefined),
			stopAll: jest.fn().mockResolvedValue(undefined),
		} as any;

		mockEnterpriseAgentUpdatedConsumer = createMockService() as any;

		mockKafkaProducerService = createMockService() as any;
		(mockKafkaProducerService.getId as jest.Mock).mockReturnValue('producer-global');

		mockConfigService = {
			get: jest.fn().mockReturnValue('dev'), // Non-local environment
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				KafkaBootstrapService,
				{ provide: getRepositoryToken(KafkaServiceEntity), useValue: mockKafkaServiceRepo },
				{ provide: KafkaRuntimeManager, useValue: mockKafkaRuntimeManager },
				{ provide: EnterpriseAgentUpdatedConsumer, useValue: mockEnterpriseAgentUpdatedConsumer },
				{ provide: KafkaProducerService, useValue: mockKafkaProducerService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
			],
		}).compile();

		service = module.get<KafkaBootstrapService>(KafkaBootstrapService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('onApplicationBootstrap', () => {
		it('should skip bootstrap in local environment', async () => {
			mockConfigService.get.mockReturnValue('local');

			await service.onApplicationBootstrap();

			expect(mockKafkaServiceRepo.find).not.toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Kafka bootstrap skipped - NODE_ENV is "local". Kafka integration only runs in AWS environments.',
			);
		});

		it('should bootstrap enabled services in non-local environment', async () => {
			const entity = createMockEntity();
			mockKafkaServiceRepo.find.mockResolvedValue([entity]);

			await service.onApplicationBootstrap();

			expect(mockKafkaServiceRepo.find).toHaveBeenCalledWith({
				where: { enabled: true },
			});
			expect(mockKafkaRuntimeManager.register).toHaveBeenCalled();
			expect(mockKafkaRuntimeManager.start).toHaveBeenCalled();
		});

		it('should only load enabled services', async () => {
			const enabledEntity = createMockEntity({ id: 'enabled-1', enabled: true });
			const disabledEntity = createMockEntity({ id: 'disabled-1', enabled: false });

			mockKafkaServiceRepo.find.mockResolvedValue([enabledEntity]);

			await service.onApplicationBootstrap();

			// Verify query filters by enabled = true
			expect(mockKafkaServiceRepo.find).toHaveBeenCalledWith({
				where: { enabled: true },
			});
			// Only enabled service should be registered
			expect(mockKafkaRuntimeManager.register).toHaveBeenCalledTimes(1);
		});

		it('should handle bootstrap errors gracefully', async () => {
			mockKafkaServiceRepo.find.mockRejectedValue(new Error('Database error'));

			await service.onApplicationBootstrap();

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Failed to bootstrap Kafka services',
				expect.objectContaining({
					error: 'Database error',
				}),
			);
		});

		it('should log when no enabled services found', async () => {
			mockKafkaServiceRepo.find.mockResolvedValue([]);

			await service.onApplicationBootstrap();

			expect(mockLogger.info).toHaveBeenCalledWith('No enabled Kafka services found in database');
		});
	});

	describe('registerServiceEntity', () => {
		it('should register a new service entity', () => {
			const entity = createMockEntity();

			const result = service.registerServiceEntity(entity);

			expect(result).toBeDefined();
			expect(result?.entity).toEqual(entity);
			expect(mockKafkaRuntimeManager.register).toHaveBeenCalled();
		});

		it('should return existing entry if already in service map', () => {
			const entity = createMockEntity();
			
			// First registration
			const firstResult = service.registerServiceEntity(entity);
			
			// Second registration should return same entry
			const secondResult = service.registerServiceEntity(entity);

			expect(firstResult).toBe(secondResult);
			expect(mockKafkaRuntimeManager.register).toHaveBeenCalledTimes(1);
		});

		it('should map consumer entity to consumer service', () => {
			const entity = createMockEntity({ type: KafkaServiceType.CONSUMER });

			const result = service.registerServiceEntity(entity);

			expect(result).toBeDefined();
			expect(result?.service).toBe(mockEnterpriseAgentUpdatedConsumer);
		});

		it('should map producer entity to producer service', () => {
			const entity = createMockEntity({
				type: KafkaServiceType.PRODUCER,
				topic: 'global',
				groupId: undefined,
			});

			const result = service.registerServiceEntity(entity);

			expect(result).toBeDefined();
			expect(result?.service).toBe(mockKafkaProducerService);
		});

		it('should return undefined for unknown consumer topic', () => {
			const entity = createMockEntity({
				type: KafkaServiceType.CONSUMER,
				topic: 'UnknownTopic',
			});

			const result = service.registerServiceEntity(entity);

			expect(result).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Unknown consumer topic: UnknownTopic',
				expect.objectContaining({
					topic: 'UnknownTopic',
				}),
			);
		});

		it('should return undefined for unknown service type', () => {
			const entity = createMockEntity({
				type: 'unknown' as any,
			});

			const result = service.registerServiceEntity(entity);

			expect(result).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Unknown service type: unknown',
				expect.objectContaining({
					type: 'unknown',
				}),
			);
		});
	});

	describe('getServiceByEntityId', () => {
		it('should return service entry by entity ID', () => {
			const entity = createMockEntity();
			service.registerServiceEntity(entity);

			const result = service.getServiceByEntityId(entity.id);

			expect(result).toBeDefined();
			expect(result?.entity.id).toBe(entity.id);
		});

		it('should return undefined if entity not found', () => {
			const result = service.getServiceByEntityId('non-existent-id');

			expect(result).toBeUndefined();
		});
	});

	describe('getServiceIdByEntityId', () => {
		it('should return service ID by entity ID', () => {
			const entity = createMockEntity();
			service.registerServiceEntity(entity);

			const result = service.getServiceIdByEntityId(entity.id);

			expect(result).toBe('consumer-Enterprise_AgentUpdated_V2-agent-service-group');
		});

		it('should return undefined if entity not found', () => {
			const result = service.getServiceIdByEntityId('non-existent-id');

			expect(result).toBeUndefined();
		});
	});

	describe('getEntityIdByServiceId', () => {
		it('should return entity ID by service ID', () => {
			const entity = createMockEntity();
			service.registerServiceEntity(entity);

			const result = service.getEntityIdByServiceId('consumer-Enterprise_AgentUpdated_V2-agent-service-group');

			expect(result).toBe(entity.id);
		});

		it('should return undefined if service ID not found', () => {
			const result = service.getEntityIdByServiceId('non-existent-service-id');

			expect(result).toBeUndefined();
		});
	});

	describe('onApplicationShutdown', () => {
		it('should skip shutdown in local environment', async () => {
			mockConfigService.get.mockReturnValue('local');

			await service.onApplicationShutdown('SIGTERM');

			expect(mockKafkaRuntimeManager.stopAll).not.toHaveBeenCalled();
		});

		it('should stop all services in non-local environment', async () => {
			mockConfigService.get.mockReturnValue('dev');
			mockKafkaRuntimeManager.stopAll.mockResolvedValue(undefined);

			await service.onApplicationShutdown('SIGTERM');

			expect(mockKafkaRuntimeManager.stopAll).toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith('Kafka services shut down on signal: SIGTERM');
		});

		it('should handle shutdown errors gracefully', async () => {
			mockConfigService.get.mockReturnValue('dev');
			mockKafkaRuntimeManager.stopAll.mockRejectedValue(new Error('Shutdown failed'));

			await service.onApplicationShutdown('SIGTERM');

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Error during Kafka shutdown',
				expect.objectContaining({
					error: 'Shutdown failed',
				}),
			);
		});
	});
});

