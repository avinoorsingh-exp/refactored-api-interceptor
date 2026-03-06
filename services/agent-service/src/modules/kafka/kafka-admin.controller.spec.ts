import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaAdminController } from './kafka-admin.controller.js';
import { KafkaRuntimeManager, KafkaServiceStatus } from './kafka-runtime-manager.service.js';
import { KafkaBootstrapService } from './kafka-bootstrap.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { KafkaServiceEntity, KafkaServiceType } from '@exprealty/database';

describe('KafkaAdminController', () => {
	let controller: KafkaAdminController;
	let mockKafkaServiceRepo: jest.Mocked<Repository<KafkaServiceEntity>>;
	let mockKafkaRuntimeManager: jest.Mocked<KafkaRuntimeManager>;
	let mockKafkaBootstrapService: jest.Mocked<KafkaBootstrapService>;
	let mockLogger: jest.Mocked<LoggerService>;

	const mockEntityId = '123e4567-e89b-12d3-a456-426614174000';
	const mockServiceId = 'consumer-Enterprise_AgentUpdated_V2-agent-service-group';

	const createMockEntity = (overrides?: Partial<KafkaServiceEntity>): KafkaServiceEntity => ({
		id: mockEntityId,
		type: KafkaServiceType.CONSUMER,
		topic: 'Enterprise_AgentUpdated_V2',
		groupId: 'agent-service-group',
		enabled: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	const createMockRuntime = (overrides?: Partial<any>): any => ({
		id: mockServiceId,
		type: 'consumer',
		topic: 'Enterprise_AgentUpdated_V2',
		groupId: 'agent-service-group',
		status: KafkaServiceStatus.RUNNING,
		startedAt: new Date(),
		...overrides,
	});

	const createMockServiceEntry = () => ({
		service: {
			getId: jest.fn().mockReturnValue(mockServiceId),
			getType: jest.fn().mockReturnValue('consumer'),
			getTopic: jest.fn().mockReturnValue('Enterprise_AgentUpdated_V2'),
			getGroupId: jest.fn().mockReturnValue('agent-service-group'),
			start: jest.fn().mockResolvedValue({}),
			stop: jest.fn().mockResolvedValue(undefined),
		},
		entity: createMockEntity(),
	});

	beforeEach(async () => {
		mockKafkaServiceRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			save: jest.fn(),
		} as any;

		mockKafkaRuntimeManager = {
			getAllRuntimes: jest.fn().mockReturnValue([]),
			getRuntime: jest.fn(),
			start: jest.fn().mockResolvedValue(undefined),
			stop: jest.fn().mockResolvedValue(undefined),
			isRegistered: jest.fn().mockReturnValue(false),
			register: jest.fn(),
		} as any;

		mockKafkaBootstrapService = {
			getEntityIdByServiceId: jest.fn(),
			getServiceByEntityId: jest.fn(),
			getServiceIdByEntityId: jest.fn(),
			registerServiceEntity: jest.fn(),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			controllers: [KafkaAdminController],
			providers: [
				{ provide: getRepositoryToken(KafkaServiceEntity), useValue: mockKafkaServiceRepo },
				{ provide: KafkaRuntimeManager, useValue: mockKafkaRuntimeManager },
				{ provide: KafkaBootstrapService, useValue: mockKafkaBootstrapService },
				{ provide: LoggerService, useValue: mockLogger },
			],
		}).compile();

		controller = module.get<KafkaAdminController>(KafkaAdminController);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('getServices', () => {
		it('should return all services from database with runtime state', async () => {
			const entity1 = createMockEntity({ id: 'entity-1' });
			const entity2 = createMockEntity({ id: 'entity-2', enabled: false });
			const runtime1 = createMockRuntime({ id: 'service-1' });

			mockKafkaServiceRepo.find.mockResolvedValue([entity1, entity2]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([runtime1]);
			mockKafkaBootstrapService.getEntityIdByServiceId.mockReturnValue('entity-1');
			mockKafkaBootstrapService.getServiceIdByEntityId.mockReturnValue('service-1');

			const req = { headers: {} } as any;
			const result = await controller.getServices(req);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				entityId: 'entity-1',
				enabled: true,
				status: KafkaServiceStatus.RUNNING,
			});
			expect(result[1]).toMatchObject({
				entityId: 'entity-2',
				enabled: false,
				status: KafkaServiceStatus.STOPPED,
			});
		});

		it('should include enabled flag from database', async () => {
			const entity = createMockEntity({ enabled: false });
			mockKafkaServiceRepo.find.mockResolvedValue([entity]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([]);
			mockKafkaBootstrapService.getServiceIdByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			const result = await controller.getServices(req);

			expect(result[0].enabled).toBe(false);
		});

		it('should sort services with global producer first', async () => {
			const globalProducer = createMockEntity({
				id: 'producer-entity',
				type: KafkaServiceType.PRODUCER,
				topic: 'global',
				groupId: null,
			});
			const consumer1 = createMockEntity({
				id: 'consumer-1',
				type: KafkaServiceType.CONSUMER,
				topic: 'Topic_B',
			});
			const consumer2 = createMockEntity({
				id: 'consumer-2',
				type: KafkaServiceType.CONSUMER,
				topic: 'Topic_A',
			});

			mockKafkaServiceRepo.find.mockResolvedValue([consumer1, globalProducer, consumer2]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([]);
			mockKafkaBootstrapService.getServiceIdByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			const result = await controller.getServices(req);

			expect(result).toHaveLength(3);
			expect(result[0].type).toBe(KafkaServiceType.PRODUCER);
			expect(result[0].topic).toBe('global');
			expect(result[0].entityId).toBe('producer-entity');
		});

		it('should sort non-producer services alphabetically by topic after global producer', async () => {
			const globalProducer = createMockEntity({
				id: 'producer-entity',
				type: KafkaServiceType.PRODUCER,
				topic: 'global',
				groupId: null,
			});
			const consumer1 = createMockEntity({
				id: 'consumer-1',
				type: KafkaServiceType.CONSUMER,
				topic: 'Zebra_Topic',
			});
			const consumer2 = createMockEntity({
				id: 'consumer-2',
				type: KafkaServiceType.CONSUMER,
				topic: 'Alpha_Topic',
			});
			const consumer3 = createMockEntity({
				id: 'consumer-3',
				type: KafkaServiceType.CONSUMER,
				topic: 'Beta_Topic',
			});

			mockKafkaServiceRepo.find.mockResolvedValue([consumer1, globalProducer, consumer3, consumer2]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([]);
			mockKafkaBootstrapService.getServiceIdByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			const result = await controller.getServices(req);

			expect(result).toHaveLength(4);
			expect(result[0].topic).toBe('global');
			expect(result[1].topic).toBe('Alpha_Topic');
			expect(result[2].topic).toBe('Beta_Topic');
			expect(result[3].topic).toBe('Zebra_Topic');
		});

		it('should maintain stable order when no global producer exists', async () => {
			const consumer1 = createMockEntity({
				id: 'consumer-1',
				type: KafkaServiceType.CONSUMER,
				topic: 'Zebra_Topic',
			});
			const consumer2 = createMockEntity({
				id: 'consumer-2',
				type: KafkaServiceType.CONSUMER,
				topic: 'Alpha_Topic',
			});
			const consumer3 = createMockEntity({
				id: 'consumer-3',
				type: KafkaServiceType.CONSUMER,
				topic: 'Beta_Topic',
			});

			mockKafkaServiceRepo.find.mockResolvedValue([consumer1, consumer3, consumer2]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([]);
			mockKafkaBootstrapService.getServiceIdByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			const result = await controller.getServices(req);

			expect(result).toHaveLength(3);
			expect(result[0].topic).toBe('Alpha_Topic');
			expect(result[1].topic).toBe('Beta_Topic');
			expect(result[2].topic).toBe('Zebra_Topic');
		});

		it('should handle empty services array', async () => {
			mockKafkaServiceRepo.find.mockResolvedValue([]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([]);

			const req = { headers: {} } as any;
			const result = await controller.getServices(req);

			expect(result).toHaveLength(0);
		});

		it('should not treat non-global producers as global producer', async () => {
			const topicProducer = createMockEntity({
				id: 'topic-producer',
				type: KafkaServiceType.PRODUCER,
				topic: 'specific-topic',
				groupId: null,
			});
			const consumer = createMockEntity({
				id: 'consumer-1',
				type: KafkaServiceType.CONSUMER,
				topic: 'Alpha_Topic',
			});

			mockKafkaServiceRepo.find.mockResolvedValue([consumer, topicProducer]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([]);
			mockKafkaBootstrapService.getServiceIdByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			const result = await controller.getServices(req);

			expect(result).toHaveLength(2);
			// Both should be sorted alphabetically by topic (no global producer)
			expect(result[0].topic).toBe('Alpha_Topic');
			expect(result[1].topic).toBe('specific-topic');
		});

		it('should maintain consistent order across multiple calls', async () => {
			const globalProducer = createMockEntity({
				id: 'producer-entity',
				type: KafkaServiceType.PRODUCER,
				topic: 'global',
				groupId: null,
			});
			const consumer1 = createMockEntity({
				id: 'consumer-1',
				type: KafkaServiceType.CONSUMER,
				topic: 'Topic_B',
			});
			const consumer2 = createMockEntity({
				id: 'consumer-2',
				type: KafkaServiceType.CONSUMER,
				topic: 'Topic_A',
			});

			mockKafkaServiceRepo.find.mockResolvedValue([consumer1, globalProducer, consumer2]);
			mockKafkaRuntimeManager.getAllRuntimes.mockReturnValue([]);
			mockKafkaBootstrapService.getServiceIdByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			const result1 = await controller.getServices(req);
			const result2 = await controller.getServices(req);

			expect(result1).toHaveLength(3);
			expect(result2).toHaveLength(3);
			expect(result1[0].entityId).toBe(result2[0].entityId);
			expect(result1[1].entityId).toBe(result2[1].entityId);
			expect(result1[2].entityId).toBe(result2[2].entityId);
		});
	});

	describe('startService', () => {
		it('should start a service successfully', async () => {
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime();

			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);
			mockKafkaServiceRepo.findOne.mockResolvedValue(serviceEntry.entity);

			const req = { headers: {} } as any;
			const result = await controller.startService(mockEntityId, req);

			expect(mockKafkaRuntimeManager.start).toHaveBeenCalledWith(mockServiceId, serviceEntry.service);
			expect(result.service).toMatchObject({
				entityId: mockEntityId,
				enabled: true,
				status: KafkaServiceStatus.RUNNING,
			});
		});

		it('should throw NotFoundException if service not found', async () => {
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			await expect(controller.startService(mockEntityId, req)).rejects.toThrow(NotFoundException);
		});

		it('should return enabled flag from database', async () => {
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime();
			const updatedEntity = createMockEntity({ enabled: false });

			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);
			mockKafkaServiceRepo.findOne.mockResolvedValue(updatedEntity);

			const req = { headers: {} } as any;
			const result = await controller.startService(mockEntityId, req);

			expect(result.service.enabled).toBe(false);
		});
	});

	describe('stopService', () => {
		it('should stop a service successfully', async () => {
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime({ status: KafkaServiceStatus.STOPPED });

			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);
			mockKafkaServiceRepo.findOne.mockResolvedValue(serviceEntry.entity);

			const req = { headers: {} } as any;
			const result = await controller.stopService(mockEntityId, req);

			expect(mockKafkaRuntimeManager.stop).toHaveBeenCalledWith(mockServiceId, serviceEntry.service);
			expect(result.service).toMatchObject({
				entityId: mockEntityId,
				enabled: true,
				status: KafkaServiceStatus.STOPPED,
			});
		});

		it('should throw NotFoundException if service not found', async () => {
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			await expect(controller.stopService(mockEntityId, req)).rejects.toThrow(NotFoundException);
		});
	});

	describe('enableService', () => {
		it('should enable and start a service successfully', async () => {
			const entity = createMockEntity({ enabled: false });
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime();

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity) // First call: check if exists
				.mockResolvedValueOnce({ ...entity, enabled: true }); // Second call: after update
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.isRegistered.mockReturnValue(true);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);

			const req = { headers: {} } as any;
			const result = await controller.enableService(mockEntityId, req);

			expect(mockKafkaServiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
			expect(mockKafkaRuntimeManager.start).toHaveBeenCalledWith(mockServiceId, serviceEntry.service);
			expect(result.service).toMatchObject({
				entityId: mockEntityId,
				enabled: true,
				status: KafkaServiceStatus.RUNNING,
			});
		});

		it('should register service if not already registered', async () => {
			const entity = createMockEntity({ enabled: false });
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime();

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity)
				.mockResolvedValueOnce({ ...entity, enabled: true });
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.isRegistered.mockReturnValue(false);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);

			const req = { headers: {} } as any;
			await controller.enableService(mockEntityId, req);

			expect(mockKafkaRuntimeManager.register).toHaveBeenCalledWith(serviceEntry.service);
		});

		it('should register service entity if not in service map', async () => {
			const entity = createMockEntity({ enabled: false });
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime();

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity)
				.mockResolvedValueOnce({ ...entity, enabled: true });
			mockKafkaBootstrapService.getServiceByEntityId
				.mockReturnValueOnce(undefined) // Not in service map
				.mockReturnValueOnce(serviceEntry); // After registration
			mockKafkaBootstrapService.registerServiceEntity.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.isRegistered.mockReturnValue(true);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);

			const req = { headers: {} } as any;
			await controller.enableService(mockEntityId, req);

			expect(mockKafkaBootstrapService.registerServiceEntity).toHaveBeenCalledWith(entity);
		});

		it('should throw NotFoundException if service not found in database', async () => {
			mockKafkaServiceRepo.findOne.mockResolvedValue(null);

			const req = { headers: {} } as any;
			await expect(controller.enableService(mockEntityId, req)).rejects.toThrow(NotFoundException);
		});

		it('should be idempotent - skip database update if already enabled', async () => {
			const entity = createMockEntity({ enabled: true });
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime();

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity)
				.mockResolvedValueOnce(entity);
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.isRegistered.mockReturnValue(true);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);

			const req = { headers: {} } as any;
			await controller.enableService(mockEntityId, req);

			// Should not call save if already enabled
			expect(mockKafkaServiceRepo.save).not.toHaveBeenCalled();
		});

		it('should throw NotFoundException if service registration fails', async () => {
			const entity = createMockEntity({ enabled: false });

			mockKafkaServiceRepo.findOne.mockResolvedValue(entity);
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(undefined);
			mockKafkaBootstrapService.registerServiceEntity.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			await expect(controller.enableService(mockEntityId, req)).rejects.toThrow(NotFoundException);
		});
	});

	describe('disableService', () => {
		it('should disable and stop a service successfully', async () => {
			const entity = createMockEntity({ enabled: true });
			const serviceEntry = createMockServiceEntry();
			const runtime = createMockRuntime({ status: KafkaServiceStatus.STOPPED });

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity) // First call: check if exists
				.mockResolvedValueOnce({ ...entity, enabled: false }); // Second call: after update
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.isRegistered.mockReturnValue(true);
			mockKafkaRuntimeManager.getRuntime.mockReturnValue(runtime);

			const req = { headers: {} } as any;
			const result = await controller.disableService(mockEntityId, req);

			expect(mockKafkaServiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
			expect(mockKafkaRuntimeManager.stop).toHaveBeenCalledWith(mockServiceId, serviceEntry.service);
			expect(result.service).toMatchObject({
				entityId: mockEntityId,
				enabled: false,
				status: KafkaServiceStatus.STOPPED,
			});
		});

		it('should not fail if service is not registered', async () => {
			const entity = createMockEntity({ enabled: true });

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity)
				.mockResolvedValueOnce({ ...entity, enabled: false });
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			const result = await controller.disableService(mockEntityId, req);

			expect(mockKafkaServiceRepo.save).toHaveBeenCalled();
			expect(result.service.enabled).toBe(false);
		});

		it('should not fail if service is not running', async () => {
			const entity = createMockEntity({ enabled: true });
			const serviceEntry = createMockServiceEntry();

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity)
				.mockResolvedValueOnce({ ...entity, enabled: false });
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.isRegistered.mockReturnValue(false);

			const req = { headers: {} } as any;
			const result = await controller.disableService(mockEntityId, req);

			expect(mockKafkaServiceRepo.save).toHaveBeenCalled();
			expect(mockKafkaRuntimeManager.stop).not.toHaveBeenCalled();
			expect(result.service.enabled).toBe(false);
		});

		it('should handle stop errors gracefully', async () => {
			const entity = createMockEntity({ enabled: true });
			const serviceEntry = createMockServiceEntry();

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity)
				.mockResolvedValueOnce({ ...entity, enabled: false });
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(serviceEntry);
			mockKafkaRuntimeManager.isRegistered.mockReturnValue(true);
			mockKafkaRuntimeManager.stop.mockRejectedValue(new Error('Stop failed'));

			const req = { headers: {} } as any;
			const result = await controller.disableService(mockEntityId, req);

			// Should still succeed - database update is source of truth
			expect(mockKafkaServiceRepo.save).toHaveBeenCalled();
			expect(result.service.enabled).toBe(false);
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it('should throw NotFoundException if service not found in database', async () => {
			mockKafkaServiceRepo.findOne.mockResolvedValue(null);

			const req = { headers: {} } as any;
			await expect(controller.disableService(mockEntityId, req)).rejects.toThrow(NotFoundException);
		});

		it('should be idempotent - skip database update if already disabled', async () => {
			const entity = createMockEntity({ enabled: false });

			mockKafkaServiceRepo.findOne
				.mockResolvedValueOnce(entity)
				.mockResolvedValueOnce(entity);
			mockKafkaBootstrapService.getServiceByEntityId.mockReturnValue(undefined);

			const req = { headers: {} } as any;
			await controller.disableService(mockEntityId, req);

			// Should not call save if already disabled
			expect(mockKafkaServiceRepo.save).not.toHaveBeenCalled();
		});
	});
});

