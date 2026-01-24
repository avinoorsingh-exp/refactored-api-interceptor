import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AdminJobService } from './admin-job.service.js';
import { AdminJobHandler, JobExecutionResult } from './admin-job-handler.interface.js';
import { AdminJobEntity, AdminJobExecutionEntity, AdminJobExecutionStatus } from '@exprealty/database';
import { JobLogCaptureService } from './job-log-capture.service.js';
import { LoggerService } from '../../../core/logger.service.js';

describe('AdminJobService', () => {
	let service: AdminJobService;
	let mockJobRepo: jest.Mocked<Repository<AdminJobEntity>>;
	let mockExecutionRepo: jest.Mocked<Repository<AdminJobExecutionEntity>>;
	let mockDataSource: jest.Mocked<DataSource>;
	let mockSchedulerRegistry: jest.Mocked<SchedulerRegistry>;
	let mockLogCaptureService: jest.Mocked<JobLogCaptureService>;
	let mockLogger: jest.Mocked<LoggerService>;
	let mockQueryRunner: jest.Mocked<QueryRunner>;

	const createMockJob = (overrides?: Partial<AdminJobEntity>): AdminJobEntity => ({
		name: 'test-job',
		description: 'Test job description',
		cronExpression: '0 2 * * *',
		enabled: true,
		runCount: 0,
		failureCount: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	const createMockManualJob = (overrides?: Partial<AdminJobEntity>): AdminJobEntity => ({
		name: 'manual-job',
		description: 'Manual job description',
		cronExpression: null,
		enabled: true,
		runCount: 0,
		failureCount: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	const createMockHandler = (overrides?: Partial<AdminJobHandler>): AdminJobHandler => ({
		name: 'test-job',
		description: 'Test job description',
		cron: '0 2 * * *',
		run: jest.fn().mockResolvedValue(undefined),
		...overrides,
	});

	beforeEach(async () => {
		mockQueryRunner = {
			connect: jest.fn().mockResolvedValue(undefined),
			startTransaction: jest.fn().mockResolvedValue(undefined),
			commitTransaction: jest.fn().mockResolvedValue(undefined),
			rollbackTransaction: jest.fn().mockResolvedValue(undefined),
			release: jest.fn().mockResolvedValue(undefined),
			manager: {
				findOne: jest.fn(),
				create: jest.fn(),
				save: jest.fn(),
				merge: jest.fn(),
			},
		} as any;

		mockJobRepo = {
			findOne: jest.fn(),
			save: jest.fn(),
			find: jest.fn(),
		} as any;

		mockExecutionRepo = {
			create: jest.fn(),
			save: jest.fn(),
			find: jest.fn(),
			findOne: jest.fn(),
		} as any;

		mockDataSource = {
			createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
		} as any;

		mockSchedulerRegistry = {
			addCronJob: jest.fn(),
			getCronJob: jest.fn(),
		} as any;

		mockLogCaptureService = {
			startCapture: jest.fn(),
			stopCapture: jest.fn().mockReturnValue('[]'),
			log: jest.fn(),
			logQuery: jest.fn(),
			logResult: jest.fn(),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AdminJobService,
				{
					provide: getRepositoryToken(AdminJobEntity),
					useValue: mockJobRepo,
				},
				{
					provide: getRepositoryToken(AdminJobExecutionEntity),
					useValue: mockExecutionRepo,
				},
				{
					provide: DataSource,
					useValue: mockDataSource,
				},
				{
					provide: SchedulerRegistry,
					useValue: mockSchedulerRegistry,
				},
				{
					provide: JobLogCaptureService,
					useValue: mockLogCaptureService,
				},
				{
					provide: LoggerService,
					useValue: mockLogger,
				},
			],
		}).compile();

		service = module.get<AdminJobService>(AdminJobService);
	});

	describe('register', () => {
		it('should register a scheduled job handler', () => {
			const handler = createMockHandler();
			service.register(handler);
			expect(mockLogger.info).toHaveBeenCalledWith('Job handler registered', {
				name: 'test-job',
				cron: '0 2 * * *',
			});
		});

		it('should register a manual job handler with null cron', () => {
			const handler = createMockHandler({ cron: null });
			service.register(handler);
			expect(mockLogger.info).toHaveBeenCalledWith('Job handler registered', {
				name: 'test-job',
				cron: null,
			});
		});
	});

	describe('onApplicationBootstrap', () => {
		it('should initialize scheduled job and add to scheduler', async () => {
			const handler = createMockHandler();
			service.register(handler);

			mockQueryRunner.manager.findOne.mockResolvedValue(null);
			mockQueryRunner.manager.create.mockReturnValue(createMockJob());
			mockQueryRunner.manager.save.mockResolvedValue(createMockJob());
			mockJobRepo.findOne.mockResolvedValue(createMockJob());

			await service.onApplicationBootstrap();

			expect(mockQueryRunner.manager.findOne).toHaveBeenCalled();
			expect(mockQueryRunner.manager.create).toHaveBeenCalled();
			expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalled();
		});

		it('should initialize manual job but not add to scheduler', async () => {
			const handler = createMockHandler({ cron: null, name: 'manual-job' });
			service.register(handler);

			mockQueryRunner.manager.findOne.mockResolvedValue(null);
			mockQueryRunner.manager.create.mockReturnValue(createMockManualJob());
			mockQueryRunner.manager.save.mockResolvedValue(createMockManualJob());
			mockJobRepo.findOne.mockResolvedValue(createMockManualJob());

			await service.onApplicationBootstrap();

			expect(mockQueryRunner.manager.findOne).toHaveBeenCalled();
			expect(mockQueryRunner.manager.create).toHaveBeenCalled();
			const createCall = mockQueryRunner.manager.create.mock.calls[0];
			expect(createCall[1]).toMatchObject({
				cronExpression: null,
			});
			expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Job is manual-only (no cron schedule)',
				{ name: 'manual-job' },
			);
		});

		it('should not schedule disabled jobs', async () => {
			const handler = createMockHandler();
			service.register(handler);

			mockQueryRunner.manager.findOne.mockResolvedValue(null);
			mockQueryRunner.manager.create.mockReturnValue(createMockJob());
			mockQueryRunner.manager.save.mockResolvedValue(createMockJob());
			mockJobRepo.findOne.mockResolvedValue(createMockJob({ enabled: false }));

			await service.onApplicationBootstrap();

			expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
		});

		it('should handle existing job in database', async () => {
			const handler = createMockHandler();
			service.register(handler);

			const existingJob = createMockJob();
			mockQueryRunner.manager.findOne.mockResolvedValue(existingJob);
			mockQueryRunner.manager.merge.mockReturnValue(existingJob);
			mockQueryRunner.manager.save.mockResolvedValue(existingJob);
			mockJobRepo.findOne.mockResolvedValue(existingJob);

			await service.onApplicationBootstrap();

			expect(mockQueryRunner.manager.findOne).toHaveBeenCalled();
			expect(mockQueryRunner.manager.merge).toHaveBeenCalled();
			expect(mockQueryRunner.manager.create).not.toHaveBeenCalled();
		});
	});

	describe('executeJob', () => {
		it('should execute scheduled job successfully', async () => {
			const handler = createMockHandler();
			service.register(handler);

			const job = createMockJob();
			mockJobRepo.findOne.mockResolvedValue(job);
			mockExecutionRepo.create.mockReturnValue({
				id: 'exec-1',
				jobName: 'test-job',
				status: AdminJobExecutionStatus.RUNNING,
				startedAt: new Date(),
			} as AdminJobExecutionEntity);
			mockExecutionRepo.save.mockResolvedValue({
				id: 'exec-1',
				status: AdminJobExecutionStatus.SUCCESS,
			} as AdminJobExecutionEntity);

			await service.executeJob('test-job');

			expect(mockLogCaptureService.startCapture).toHaveBeenCalled();
			expect(handler.run).toHaveBeenCalled();
			expect(mockLogCaptureService.stopCapture).toHaveBeenCalled();
			expect(mockExecutionRepo.save).toHaveBeenCalled();
		});

		it('should execute manual job successfully', async () => {
			const handler = createMockHandler({ cron: null, name: 'manual-job' });
			service.register(handler);

			const job = createMockManualJob();
			mockJobRepo.findOne.mockResolvedValue(job);
			mockExecutionRepo.create.mockReturnValue({
				id: 'exec-1',
				jobName: 'manual-job',
				status: AdminJobExecutionStatus.RUNNING,
				startedAt: new Date(),
			} as AdminJobExecutionEntity);
			mockExecutionRepo.save.mockResolvedValue({
				id: 'exec-1',
				status: AdminJobExecutionStatus.SUCCESS,
			} as AdminJobExecutionEntity);

			await service.executeJob('manual-job');

			expect(handler.run).toHaveBeenCalled();
			expect(mockExecutionRepo.save).toHaveBeenCalled();
		});

		it('should handle job execution failure', async () => {
			const handler = createMockHandler();
			handler.run = jest.fn().mockRejectedValue(new Error('Job failed'));
			service.register(handler);

			const job = createMockJob();
			mockJobRepo.findOne.mockResolvedValue(job);
			mockExecutionRepo.create.mockReturnValue({
				id: 'exec-1',
				jobName: 'test-job',
				status: AdminJobExecutionStatus.RUNNING,
				startedAt: new Date(),
			} as AdminJobExecutionEntity);
			mockExecutionRepo.save.mockResolvedValue({
				id: 'exec-1',
				status: AdminJobExecutionStatus.FAILED,
			} as AdminJobExecutionEntity);

			await service.executeJob('test-job');

			expect(mockExecutionRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					status: AdminJobExecutionStatus.FAILED,
					error: 'Job failed',
				}),
			);
			expect(job.failureCount).toBe(1);
		});

		it('should not execute if job is disabled', async () => {
			const handler = createMockHandler();
			service.register(handler);

			const job = createMockJob({ enabled: false });
			mockJobRepo.findOne.mockResolvedValue(job);

			await service.executeJob('test-job');

			expect(handler.run).not.toHaveBeenCalled();
		});
	});

	describe('triggerJob', () => {
		it('should trigger a scheduled job', async () => {
			const handler = createMockHandler();
			service.register(handler);

			const job = createMockJob();
			mockJobRepo.findOne.mockResolvedValue(job);
			mockExecutionRepo.create.mockReturnValue({
				id: 'exec-1',
				jobName: 'test-job',
				status: AdminJobExecutionStatus.RUNNING,
				startedAt: new Date(),
			} as AdminJobExecutionEntity);
			mockExecutionRepo.save.mockResolvedValue({} as AdminJobExecutionEntity);

			await service.triggerJob('test-job');

			expect(handler.run).toHaveBeenCalled();
		});

		it('should trigger a manual job', async () => {
			const handler = createMockHandler({ cron: null, name: 'manual-job' });
			service.register(handler);

			const job = createMockManualJob();
			mockJobRepo.findOne.mockResolvedValue(job);
			mockExecutionRepo.create.mockReturnValue({
				id: 'exec-1',
				jobName: 'manual-job',
				status: AdminJobExecutionStatus.RUNNING,
				startedAt: new Date(),
			} as AdminJobExecutionEntity);
			mockExecutionRepo.save.mockResolvedValue({} as AdminJobExecutionEntity);

			await service.triggerJob('manual-job');

			expect(handler.run).toHaveBeenCalled();
		});

		it('should throw error if handler not found', async () => {
			await expect(service.triggerJob('non-existent')).rejects.toThrow(
				'Job handler not found: non-existent',
			);
		});
	});

	describe('pauseJob', () => {
		it('should pause a scheduled job', async () => {
			const mockCronJob = {
				stop: jest.fn(),
			};
			mockSchedulerRegistry.getCronJob.mockReturnValue(mockCronJob as any);

			const job = createMockJob();
			mockJobRepo.findOne.mockResolvedValue(job);
			mockJobRepo.save.mockResolvedValue(job);

			await service.pauseJob('test-job');

			expect(job.enabled).toBe(false);
			expect(mockJobRepo.save).toHaveBeenCalled();
			expect(mockCronJob.stop).toHaveBeenCalled();
		});

		it('should disable a manual job (no cron to stop)', async () => {
			const job = createMockManualJob();
			mockJobRepo.findOne.mockResolvedValue(job);
			mockJobRepo.save.mockResolvedValue(job);

			await service.pauseJob('manual-job');

			expect(job.enabled).toBe(false);
			expect(mockJobRepo.save).toHaveBeenCalled();
			expect(mockSchedulerRegistry.getCronJob).not.toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith('Manual job disabled', {
				name: 'manual-job',
			});
		});
	});

	describe('resumeJob', () => {
		it('should resume a scheduled job', async () => {
			const mockCronJob = {
				start: jest.fn(),
			};
			mockSchedulerRegistry.getCronJob.mockReturnValue(mockCronJob as any);

			const job = createMockJob({ enabled: false });
			mockJobRepo.findOne.mockResolvedValue(job);
			mockJobRepo.save.mockResolvedValue(job);

			await service.resumeJob('test-job');

			expect(job.enabled).toBe(true);
			expect(mockJobRepo.save).toHaveBeenCalled();
			expect(mockCronJob.start).toHaveBeenCalled();
		});

		it('should enable a manual job (no cron to start)', async () => {
			const job = createMockManualJob({ enabled: false });
			mockJobRepo.findOne.mockResolvedValue(job);
			mockJobRepo.save.mockResolvedValue(job);

			await service.resumeJob('manual-job');

			expect(job.enabled).toBe(true);
			expect(mockJobRepo.save).toHaveBeenCalled();
			expect(mockSchedulerRegistry.getCronJob).not.toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith('Manual job enabled', {
				name: 'manual-job',
			});
		});
	});

	describe('getAllJobs', () => {
		it('should return all jobs including manual and scheduled', async () => {
			const scheduledJob = createMockJob();
			const manualJob = createMockManualJob();
			mockJobRepo.find.mockResolvedValue([scheduledJob, manualJob]);

			const jobs = await service.getAllJobs();

			expect(jobs).toHaveLength(2);
			expect(jobs[0].cronExpression).toBe('0 2 * * *');
			expect(jobs[1].cronExpression).toBeNull();
		});
	});

	describe('getJob', () => {
		it('should return a scheduled job', async () => {
			const job = createMockJob();
			mockJobRepo.findOne.mockResolvedValue(job);

			const result = await service.getJob('test-job');

			expect(result).toEqual(job);
			expect(result?.cronExpression).toBe('0 2 * * *');
		});

		it('should return a manual job', async () => {
			const job = createMockManualJob();
			mockJobRepo.findOne.mockResolvedValue(job);

			const result = await service.getJob('manual-job');

			expect(result).toEqual(job);
			expect(result?.cronExpression).toBeNull();
		});
	});
});

