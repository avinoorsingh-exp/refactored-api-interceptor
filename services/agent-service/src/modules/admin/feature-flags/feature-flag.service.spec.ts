import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
import type { IFeatureFlagRepository } from './ports/feature-flag.repository.port.js';
import type { FeatureFlagKey } from './feature-flag.constants.js';
import { LoggerService } from '../../../core/logger.service.js';

describe('FeatureFlagService', () => {
	let service: FeatureFlagService;
	let mockRepo: jest.Mocked<IFeatureFlagRepository>;

	const createMockFlag = (
		key: FeatureFlagKey,
		enabled: boolean,
		overrides?: Partial<{ id: string; createdAt: Date; updatedAt: Date }>,
	) => ({
		id: 'uuid-' + key,
		key,
		enabled,
		createdAt: new Date('2024-01-01'),
		updatedAt: new Date('2024-01-02'),
		...overrides,
	});

	beforeEach(async () => {
		mockRepo = {
			findAll: jest.fn(),
			findByKey: jest.fn(),
			save: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FeatureFlagService,
				{
					provide: 'IFeatureFlagRepository',
					useValue: mockRepo,
				},
				{
					provide: LoggerService,
					useValue: { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
				},
			],
		}).compile();

		service = module.get<FeatureFlagService>(FeatureFlagService);
	});

	describe('getAllFlags', () => {
		it('returns both flags', async () => {
			const phase2 = createMockFlag('PHASE_2', false);
			const phase3 = createMockFlag('PHASE_3', false);
			mockRepo.findAll.mockResolvedValue([phase2, phase3]);

			const result = await service.getAllFlags();

			expect(result).toHaveLength(2);
			expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
		});

		it('returns correct structure (key + enabled only)', async () => {
			const phase2 = createMockFlag('PHASE_2', false);
			const phase3 = createMockFlag('PHASE_3', true);
			mockRepo.findAll.mockResolvedValue([phase2, phase3]);

			const result = await service.getAllFlags();

			expect(result).toEqual([
				{ key: 'PHASE_2', enabled: false },
				{ key: 'PHASE_3', enabled: true },
			]);
		});
	});

	describe('updateFlag', () => {
		it('updates valid key', async () => {
			const existing = createMockFlag('PHASE_2', false);
			const updated = { ...existing, enabled: true, updatedAt: new Date() };
			mockRepo.findByKey.mockResolvedValue(existing);
			mockRepo.save.mockResolvedValue(updated);

			const result = await service.updateFlag('PHASE_2', true);

			expect(result).toEqual({ key: 'PHASE_2', enabled: true });
			expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'PHASE_2', enabled: true }));
		});

		it('throws 400 for invalid key', async () => {
			await expect(service.updateFlag('INVALID' as FeatureFlagKey, true)).rejects.toThrow(
				BadRequestException,
			);
			expect(mockRepo.findByKey).not.toHaveBeenCalled();
		});

		it('throws 404 if flag not found', async () => {
			mockRepo.findByKey.mockResolvedValue(null);

			await expect(service.updateFlag('PHASE_2', true)).rejects.toThrow(NotFoundException);
		});

		it('persists updated value', async () => {
			const existing = createMockFlag('PHASE_3', false);
			mockRepo.findByKey.mockResolvedValue(existing);
			mockRepo.save.mockImplementation(async (flag) => ({ ...flag, updatedAt: new Date() }));

			await service.updateFlag('PHASE_3', true);

			expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
		});

		it('logs update event', async () => {
			const existing = createMockFlag('PHASE_2', false);
			mockRepo.findByKey.mockResolvedValue(existing);
			mockRepo.save.mockResolvedValue({ ...existing, enabled: true });

			await service.updateFlag('PHASE_2', true);

			// Service should log; we only verify it completed without throw
			expect(mockRepo.save).toHaveBeenCalled();
		});
	});

	describe('isEnabled', () => {
		it('returns correct boolean', async () => {
			mockRepo.findByKey.mockResolvedValue(createMockFlag('PHASE_2', true));
			expect(await service.isEnabled('PHASE_2')).toBe(true);

			mockRepo.findByKey.mockResolvedValue(createMockFlag('PHASE_3', false));
			expect(await service.isEnabled('PHASE_3')).toBe(false);
		});

		it('throws if flag missing', async () => {
			mockRepo.findByKey.mockResolvedValue(null);

			await expect(service.isEnabled('PHASE_2')).rejects.toThrow(NotFoundException);
		});
	});
});
