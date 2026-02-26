import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeatureFlagController } from './feature-flag.controller.js';
import { FeatureFlagService } from './feature-flag.service.js';

describe('FeatureFlagController', () => {
	let controller: FeatureFlagController;
	let mockService: jest.Mocked<FeatureFlagService>;

	const mockRequest: any = {
		headers: { 'x-correlation-id': 'test-123' },
	};

	beforeEach(async () => {
		mockService = {
			getAllFlags: jest.fn(),
			isEnabled: jest.fn(),
			updateFlag: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			controllers: [FeatureFlagController],
			providers: [
				{
					provide: FeatureFlagService,
					useValue: mockService,
				},
			],
		}).compile();

		controller = module.get<FeatureFlagController>(FeatureFlagController);
	});

	describe('GET /admin/feature-flags', () => {
		it('returns 200', async () => {
			mockService.getAllFlags.mockResolvedValue([
				{ key: 'PHASE_2', enabled: false },
				{ key: 'PHASE_3', enabled: false },
			]);

			const result = await controller.getFlags(mockRequest);

			expect(result).toBeDefined();
			expect(result).toHaveLength(2);
		});

		it('returns both flags', async () => {
			mockService.getAllFlags.mockResolvedValue([
				{ key: 'PHASE_2', enabled: false },
				{ key: 'PHASE_3', enabled: true },
			]);

			const result = await controller.getFlags(mockRequest);

			expect(result).toEqual([
				{ key: 'PHASE_2', enabled: false },
				{ key: 'PHASE_3', enabled: true },
			]);
		});

	});

	describe('GET /admin/feature-flags/:key', () => {
		it('returns 200 with key and enabled', async () => {
			mockService.isEnabled.mockResolvedValue(true);

			const result = await controller.getFlagByKey('PHASE_2', mockRequest);

			expect(result).toEqual({ key: 'PHASE_2', enabled: true });
			expect(mockService.isEnabled).toHaveBeenCalledWith('PHASE_2');
		});

		it('returns enabled false when flag is off', async () => {
			mockService.isEnabled.mockResolvedValue(false);

			const result = await controller.getFlagByKey('PHASE_3', mockRequest);

			expect(result).toEqual({ key: 'PHASE_3', enabled: false });
		});

		it('returns 400 for invalid key', async () => {
			await expect(controller.getFlagByKey('INVALID', mockRequest)).rejects.toThrow(
				BadRequestException,
			);
			expect(mockService.isEnabled).not.toHaveBeenCalled();
		});

		it('returns 404 if flag not found', async () => {
			mockService.isEnabled.mockRejectedValue(new NotFoundException('Not found'));

			await expect(controller.getFlagByKey('PHASE_2', mockRequest)).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('PATCH /admin/feature-flags/:key', () => {
		it('returns 200 on success', async () => {
			mockService.updateFlag.mockResolvedValue({ key: 'PHASE_2', enabled: true });

			const result = await controller.patchFlag('PHASE_2', { enabled: true }, mockRequest);

			expect(result).toEqual({ key: 'PHASE_2', enabled: true });
		});

		it('returns 400 for invalid key', async () => {
			mockService.updateFlag.mockRejectedValue(new BadRequestException('Invalid key'));

			await expect(
				controller.patchFlag('INVALID', { enabled: true }, mockRequest),
			).rejects.toThrow(BadRequestException);
		});

		it('returns 404 if not found', async () => {
			mockService.updateFlag.mockRejectedValue(new NotFoundException('Not found'));

			await expect(
				controller.patchFlag('PHASE_2', { enabled: true }, mockRequest),
			).rejects.toThrow(NotFoundException);
		});
	});
});
