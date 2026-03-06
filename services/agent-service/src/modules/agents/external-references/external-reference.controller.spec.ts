import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExternalReferenceController } from './external-reference.controller.js';
import { ExternalReferenceService } from './external-reference.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import { PaginationModule } from '../../../common/pagination/pagination.module.js';

describe('ExternalReferenceController', () => {
	let controller: ExternalReferenceController;
	let service: jest.Mocked<ExternalReferenceService>;

	const mockChildLogger = {
		setContext: jest.fn(),
		info: jest.fn(),
		operational: jest.fn(),
		critical: jest.fn(),
		lifecycle: jest.fn(),
		debugTiered: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [PaginationModule],
			controllers: [ExternalReferenceController],
			providers: [
				{
					provide: ExternalReferenceService,
					useValue: {
						create: jest.fn(),
						update: jest.fn(),
						findById: jest.fn(),
						findByAgentId: jest.fn(),
					},
				},
				{
					provide: LoggerService,
					useValue: { createScopedLogger: jest.fn().mockReturnValue(mockChildLogger) },
				},
			],
		})
			.overrideGuard(AgentExistsGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = module.get<ExternalReferenceController>(ExternalReferenceController);
		service = module.get(ExternalReferenceService) as jest.Mocked<ExternalReferenceService>;
	});

	const agent = { id: '550e8400-e29b-41d4-a716-446655440000' } as any;

	describe('findAll()', () => {
		it('should return paginated external references', async () => {
			const items = [
				{ id: 'ref-001', systemCode: 'SF', refKey: 'K', refValue: 'V' },
			] as any[];
			service.findByAgentId.mockResolvedValue({ items, total: 1 });

			const result = await controller.findAll(agent, { offset: 0, limit: 25 });

			expect(result.total).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(service.findByAgentId).toHaveBeenCalledWith(agent.id, { offset: 0, limit: 25 });
		});
	});

	describe('findById()', () => {
		it('should return the external reference', async () => {
			const ref = { id: 'ref-001', systemCode: 'SF' } as any;
			service.findById.mockResolvedValue(ref);

			const result = await controller.findById(agent, 'ref-001');

			expect(result).toEqual(ref);
			expect(service.findById).toHaveBeenCalledWith(agent.id, 'ref-001');
		});
	});

	describe('create()', () => {
		it('should create and return the external reference with Location header', async () => {
			const ref = { id: 'ref-001', systemCode: 'SALESFORCE' } as any;
			service.create.mockResolvedValue(ref);

			const mockRes = { setHeader: jest.fn() } as any;

			const result = await controller.create(
				agent,
				{ systemCode: 'SALESFORCE', refKey: 'AccountId', refValue: '001ABC' },
				mockRes,
			);

			expect(result).toEqual(ref);
			expect(mockRes.setHeader).toHaveBeenCalledWith(
				'Location',
				`/v1/agents/${agent.id}/external-references/ref-001`,
			);
			expect(mockChildLogger.operational).toHaveBeenCalled();
		});
	});

	describe('update()', () => {
		it('should update and return the external reference', async () => {
			const ref = { id: 'ref-001', systemCode: 'UPDATED' } as any;
			service.update.mockResolvedValue(ref);

			const result = await controller.update(agent, 'ref-001', { systemCode: 'UPDATED' });

			expect(result.systemCode).toBe('UPDATED');
			expect(service.update).toHaveBeenCalledWith(agent.id, 'ref-001', { systemCode: 'UPDATED' });
		});

		it('should propagate NotFoundException from service', async () => {
			service.update.mockRejectedValue(new NotFoundException());

			await expect(controller.update(agent, 'ref-999', { refValue: 'X' }))
				.rejects.toThrow(NotFoundException);
		});
	});
});
