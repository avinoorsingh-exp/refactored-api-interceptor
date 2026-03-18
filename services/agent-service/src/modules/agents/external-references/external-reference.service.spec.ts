import { NotFoundException } from '@nestjs/common';
import { ExternalReferenceService } from './external-reference.service.js';
import type { IExternalReferenceRepository } from './ports/external-reference.repository.port.js';
import { LoggerService } from '../../../core/logger.service.js';

describe('ExternalReferenceService', () => {
	let service: ExternalReferenceService;
	let repository: jest.Mocked<IExternalReferenceRepository>;
	const logger = {
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

	const mockLoggerService = {
		createScopedLogger: jest.fn().mockReturnValue(logger),
	} as unknown as LoggerService;

	beforeEach(() => {
		jest.clearAllMocks();

		repository = {
			create: jest.fn(),
			update: jest.fn(),
			findByIdForAgent: jest.fn(),
			findByAgentId: jest.fn(),
		} as jest.Mocked<IExternalReferenceRepository>;

		service = new ExternalReferenceService(repository, mockLoggerService);
	});

	describe('create()', () => {
		it('should create and return the external reference', async () => {
			const ref = {
				id: 'ref-001',
				systemCode: 'SALESFORCE',
				refKey: 'AccountId',
				refValue: '001ABC',
				createdBy: 'admin',
				created: new Date(),
				lastModified: new Date(),
				modifiedBy: 'system',
			};
			repository.create.mockResolvedValue(ref as any);

			const result = await service.create('agent-1', {
				systemCode: 'SALESFORCE',
				refKey: 'AccountId',
				refValue: '001ABC',
				createdBy: 'admin',
			});

			expect(result.id).toBe('ref-001');
			expect(repository.create).toHaveBeenCalledWith('agent-1', {
				systemCode: 'SALESFORCE',
				refKey: 'AccountId',
				refValue: '001ABC',
				createdBy: 'admin',
			});
			expect(logger.operational).toHaveBeenCalled();
		});
	});

	describe('update()', () => {
		it('should update and return the external reference', async () => {
			const ref = {
				id: 'ref-001',
				systemCode: 'UPDATED',
				refKey: 'Key',
				refValue: 'Val',
				createdBy: 'system',
				created: new Date(),
				lastModified: new Date(),
				modifiedBy: 'admin',
			};
			repository.update.mockResolvedValue(ref as any);

			const result = await service.update('agent-1', 'ref-001', {
				systemCode: 'UPDATED',
				modifiedBy: 'admin',
			});

			expect(result.systemCode).toBe('UPDATED');
		});

		it('should throw NotFoundException when not found', async () => {
			repository.update.mockResolvedValue(null);

			await expect(
				service.update('agent-1', 'ref-999', { refValue: 'new' }),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe('findById()', () => {
		it('should return the external reference', async () => {
			const ref = { id: 'ref-001', systemCode: 'SF' } as any;
			repository.findByIdForAgent.mockResolvedValue(ref);

			const result = await service.findById('agent-1', 'ref-001');

			expect(result.id).toBe('ref-001');
		});

		it('should throw NotFoundException when not found', async () => {
			repository.findByIdForAgent.mockResolvedValue(null);

			await expect(
				service.findById('agent-1', 'ref-999'),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe('findByAgentId()', () => {
		it('should return paginated results', async () => {
			const items = [{ id: 'ref-001' }, { id: 'ref-002' }] as any[];
			repository.findByAgentId.mockResolvedValue({ items, total: 2 });

			const result = await service.findByAgentId('agent-1', { offset: 0, limit: 25 });

			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(logger.debugTiered).toHaveBeenCalled();
		});
	});
});
