import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ApiActorService, type ApiActorRow } from '../../src/services/api-actor.service.js';
import { ApiActorType } from '../../src/domain/api-monitoring.types.js';
import { API_MONITORING_LOGGER_TOKEN } from '../../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../../src/interfaces/logger.interface.js';
import { API_MONITORING_ACTOR_REPO } from '../../src/tokens/repository.tokens.js';

describe('ApiActorService', () => {
	let service: ApiActorService;
	let actorRepo: jest.Mocked<Repository<ApiActorRow>>;
	let logger: jest.Mocked<IApiMonitoringLogger>;

	beforeEach(async () => {
		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		} as any;

		actorRepo = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
		} as any;

		const module = await Test.createTestingModule({
			providers: [
				ApiActorService,
				{
					provide: API_MONITORING_ACTOR_REPO,
					useValue: actorRepo,
				},
				{
					provide: API_MONITORING_LOGGER_TOKEN,
					useValue: logger,
				},
			],
		}).compile();

		service = module.get<ApiActorService>(ApiActorService);
	});

	describe('getOrCreateActor', () => {
		it('should return existing actor if found', async () => {
			const existingActor = {
				id: 'actor-123',
				type: ApiActorType.USER,
				identifier: 'user@example.com',
				active: true,
			} as ApiActorRow;

			actorRepo.findOne.mockResolvedValue(existingActor);

			const result = await service.getOrCreateActor(
				ApiActorType.USER,
				'user@example.com',
			);

			expect(result).toBe(existingActor);
			expect(actorRepo.findOne).toHaveBeenCalledWith({
				where: {
					type: ApiActorType.USER,
					identifier: 'user@example.com',
				},
			});
			expect(actorRepo.create).not.toHaveBeenCalled();
		});

		it('should create new actor if not found', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const newActor = {
				id: 'actor-456',
				type: ApiActorType.USER,
				identifier: 'user@example.com',
				displayName: 'user@example.com',
				active: true,
			} as ApiActorRow;

			actorRepo.create.mockReturnValue(newActor);
			actorRepo.save.mockResolvedValue(newActor);

			const result = await service.getOrCreateActor(
				ApiActorType.USER,
				'user@example.com',
			);

			expect(result).toBe(newActor);
			expect(actorRepo.create).toHaveBeenCalledWith(expect.objectContaining({
				type: ApiActorType.USER,
				identifier: 'user@example.com',
				active: true,
			}));
			expect(actorRepo.save).toHaveBeenCalledWith(newActor);
		});

		it('should generate display name for USER type', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const newActor = {
				id: 'actor-123',
				type: ApiActorType.USER,
				identifier: 'user@example.com',
				displayName: 'user@example.com',
				active: true,
			} as ApiActorRow;

			actorRepo.create.mockReturnValue(newActor);
			actorRepo.save.mockResolvedValue(newActor);

			await service.getOrCreateActor(
				ApiActorType.USER,
				'user@example.com',
			);

			expect(actorRepo.create).toHaveBeenCalledWith(expect.objectContaining({
				displayName: 'user@example.com',
			}));
		});

		it('should generate display name for API_KEY type', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const newActor = {
				id: 'actor-123',
				type: ApiActorType.API_KEY,
				identifier: 'api-key-123',
				displayName: 'API Key: My API Key',
				active: true,
			} as ApiActorRow;

			actorRepo.create.mockReturnValue(newActor);
			actorRepo.save.mockResolvedValue(newActor);

			await service.getOrCreateActor(
				ApiActorType.API_KEY,
				'api-key-123',
				{ apiKeyName: 'My API Key' },
			);

			expect(actorRepo.create).toHaveBeenCalledWith(expect.objectContaining({
				displayName: 'API Key: My API Key',
			}));
		});

		it('should generate display name for SERVICE_ACCOUNT type', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const newActor = {
				id: 'actor-123',
				type: ApiActorType.SERVICE_ACCOUNT,
				identifier: 'service-123',
				displayName: 'Service: service-123',
				active: true,
			} as ApiActorRow;

			actorRepo.create.mockReturnValue(newActor);
			actorRepo.save.mockResolvedValue(newActor);

			await service.getOrCreateActor(
				ApiActorType.SERVICE_ACCOUNT,
				'service-123',
			);

			expect(actorRepo.create).toHaveBeenCalledWith(expect.objectContaining({
				displayName: 'Service: service-123',
			}));
		});

		it('should generate display name for SYSTEM type', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const newActor = {
				id: 'actor-123',
				type: ApiActorType.SYSTEM,
				displayName: 'System',
				active: true,
			} as ApiActorRow;

			actorRepo.create.mockReturnValue(newActor);
			actorRepo.save.mockResolvedValue(newActor);

			await service.getOrCreateActor(ApiActorType.SYSTEM);

			expect(actorRepo.create).toHaveBeenCalledWith(expect.objectContaining({
				displayName: 'System',
			}));
		});

		it('should generate display name for ANONYMOUS type with IP', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const newActor = {
				id: 'actor-123',
				type: ApiActorType.ANONYMOUS,
				displayName: 'Anonymous (192.168.1.1)',
				active: true,
			} as ApiActorRow;

			actorRepo.create.mockReturnValue(newActor);
			actorRepo.save.mockResolvedValue(newActor);

			await service.getOrCreateActor(
				ApiActorType.ANONYMOUS,
				undefined,
				{ ip: '192.168.1.1' },
			);

			expect(actorRepo.create).toHaveBeenCalledWith(expect.objectContaining({
				displayName: 'Anonymous (192.168.1.1)',
			}));
		});

		it('should update display name for anonymous actor after save', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const newActor = {
				id: 'actor-123',
				type: ApiActorType.ANONYMOUS,
				displayName: 'Anonymous (00000000)',
				active: true,
			} as ApiActorRow;

			actorRepo.create.mockReturnValue(newActor);
			actorRepo.save.mockResolvedValue(newActor);
			actorRepo.update.mockResolvedValue({ affected: 1 } as any);

			await service.getOrCreateActor(ApiActorType.ANONYMOUS);

			expect(actorRepo.update).toHaveBeenCalledWith(
				'actor-123',
				expect.objectContaining({
					displayName: expect.stringMatching(/Anonymous \(actor-12/),
				}),
			);
		});

		it('should handle race condition by retrying find', async () => {
			actorRepo.findOne
				.mockResolvedValueOnce(null) // First find (not found)
				.mockResolvedValueOnce({
					id: 'actor-123',
					type: ApiActorType.USER,
					displayName: 'user@example.com',
					active: true,
				}); // Second find after error (active so no extra find)

			actorRepo.save.mockRejectedValue(new Error('Unique constraint violation'));

			const result = await service.getOrCreateActor(
				ApiActorType.USER,
				'user@example.com',
			);

			expect(result.id).toBe('actor-123');
			expect(actorRepo.findOne).toHaveBeenCalledTimes(2);
		});

		it('should throw error if race condition retry fails', async () => {
			actorRepo.findOne.mockResolvedValue(null);
			actorRepo.save.mockRejectedValue(new Error('Database error'));

			await expect(
				service.getOrCreateActor(ApiActorType.USER, 'user@example.com'),
			).rejects.toThrow('Database error');

			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('getActorById', () => {
		it('should return actor by ID', async () => {
			const actor = {
				id: 'actor-123',
				type: ApiActorType.USER,
				active: true,
			} as ApiActorRow;

			actorRepo.findOne.mockResolvedValue(actor);

			const result = await service.getActorById('actor-123');

			expect(result).toBe(actor);
			expect(actorRepo.findOne).toHaveBeenCalledWith({
				where: { id: 'actor-123', active: true },
			});
		});

		it('should return null if actor not found', async () => {
			actorRepo.findOne.mockResolvedValue(null);

			const result = await service.getActorById('non-existent');

			expect(result).toBeNull();
		});
	});

	describe('deactivateActor', () => {
		it('should deactivate actor', async () => {
			actorRepo.update.mockResolvedValue({ affected: 1 } as any);

			await service.deactivateActor('actor-123');

			expect(actorRepo.update).toHaveBeenCalledWith('actor-123', { active: false });
			expect(logger.info).toHaveBeenCalledWith('Deactivated API actor', {
				actorId: 'actor-123',
			});
		});
	});
});

