import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminJobsController } from './admin-jobs.controller.js';
import { AdminJobService } from './admin-job.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { AdminJobEntity, AdminJobExecutionEntity, AdminJobExecutionStatus } from '@exprealty/database';

describe('AdminJobsController', () => {
	let controller: AdminJobsController;
	let mockAdminJobService: jest.Mocked<AdminJobService>;
	let mockLogger: jest.Mocked<LoggerService>;

	const createMockJob = (overrides?: Partial<AdminJobEntity>): AdminJobEntity => ({
		name: 'test-job',
		description: 'Test job description',
		cronExpression: '0 2 * * *',
		enabled: true,
		runCount: 10,
		failureCount: 1,
		lastRunAt: new Date(),
		nextRunAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	const createMockManualJob = (overrides?: Partial<AdminJobEntity>): AdminJobEntity => ({
		name: 'manual-job',
		description: 'Manual job description',
		cronExpression: null,
		enabled: true,
		runCount: 5,
		failureCount: 0,
		lastRunAt: new Date(),
		nextRunAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	const createMockExecution = (overrides?: Partial<AdminJobExecutionEntity>): AdminJobExecutionEntity => ({
		id: 'exec-1',
		jobName: 'test-job',
		status: AdminJobExecutionStatus.SUCCESS,
		startedAt: new Date(),
		finishedAt: new Date(),
		durationMs: 100,
		error: null,
		log: '[]',
		createdAt: new Date(),
		...overrides,
	});

	const createMockRequest = (): any => ({
		headers: {
			'x-correlation-id': 'test-correlation-id',
		},
	});

	beforeEach(async () => {
		mockAdminJobService = {
			getAllJobs: jest.fn(),
			getJob: jest.fn(),
			getJobExecutions: jest.fn(),
			getExecution: jest.fn(),
			triggerJob: jest.fn(),
			pauseJob: jest.fn(),
			resumeJob: jest.fn(),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AdminJobsController],
			providers: [
				{
					provide: AdminJobService,
					useValue: mockAdminJobService,
				},
				{
					provide: LoggerService,
					useValue: mockLogger,
				},
			],
		}).compile();

		controller = module.get<AdminJobsController>(AdminJobsController);
	});

	describe('getJobs', () => {
		it('should return all jobs including scheduled and manual', async () => {
			const scheduledJob = createMockJob();
			const manualJob = createMockManualJob();
			mockAdminJobService.getAllJobs.mockResolvedValue([scheduledJob, manualJob]);

			const result = await controller.getJobs(createMockRequest());

			expect(result).toHaveLength(2);
			expect(result[0].cronExpression).toBe('0 2 * * *');
			expect(result[1].cronExpression).toBeNull();
		});

		it('should return empty array when no jobs exist', async () => {
			mockAdminJobService.getAllJobs.mockResolvedValue([]);

			const result = await controller.getJobs(createMockRequest());

			expect(result).toEqual([]);
		});
	});

	describe('getExecution', () => {
		it('should return execution details', async () => {
			const execution = createMockExecution();
			mockAdminJobService.getExecution.mockResolvedValue(execution);

			const result = await controller.getExecution('exec-1', createMockRequest());

			expect(result).toEqual({
				id: execution.id,
				jobName: execution.jobName,
				status: execution.status,
				startedAt: execution.startedAt,
				finishedAt: execution.finishedAt,
				durationMs: execution.durationMs,
				error: execution.error,
				log: execution.log,
				createdAt: execution.createdAt,
			});
		});

		it('should throw NotFoundException if execution not found', async () => {
			mockAdminJobService.getExecution.mockResolvedValue(null);

			await expect(controller.getExecution('non-existent', createMockRequest())).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('getJobStatus', () => {
		it('should return job status with executions for scheduled job', async () => {
			const job = createMockJob();
			const executions = [createMockExecution()];
			mockAdminJobService.getJob.mockResolvedValue(job);
			mockAdminJobService.getJobExecutions.mockResolvedValue(executions);

			const result = await controller.getJobStatus('test-job', createMockRequest());

			expect(result.job.cronExpression).toBe('0 2 * * *');
			expect(result.executions).toHaveLength(1);
		});

		it('should return job status with executions for manual job', async () => {
			const job = createMockManualJob();
			const executions = [createMockExecution({ jobName: 'manual-job' })];
			mockAdminJobService.getJob.mockResolvedValue(job);
			mockAdminJobService.getJobExecutions.mockResolvedValue(executions);

			const result = await controller.getJobStatus('manual-job', createMockRequest());

			expect(result.job.cronExpression).toBeNull();
			expect(result.executions).toHaveLength(1);
		});

		it('should throw NotFoundException if job not found', async () => {
			mockAdminJobService.getJob.mockResolvedValue(null);

			await expect(controller.getJobStatus('non-existent', createMockRequest())).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('triggerJob', () => {
		it('should trigger a scheduled job', async () => {
			mockAdminJobService.triggerJob.mockResolvedValue(undefined);

			const result = await controller.triggerJob('test-job', createMockRequest());

			expect(result).toEqual({ message: 'Job test-job triggered successfully' });
			expect(mockAdminJobService.triggerJob).toHaveBeenCalledWith('test-job');
		});

		it('should trigger a manual job', async () => {
			mockAdminJobService.triggerJob.mockResolvedValue(undefined);

			const result = await controller.triggerJob('manual-job', createMockRequest());

			expect(result).toEqual({ message: 'Job manual-job triggered successfully' });
			expect(mockAdminJobService.triggerJob).toHaveBeenCalledWith('manual-job');
		});
	});

	describe('pauseJob', () => {
		it('should pause a scheduled job', async () => {
			mockAdminJobService.pauseJob.mockResolvedValue(undefined);

			const result = await controller.pauseJob('test-job', createMockRequest());

			expect(result).toEqual({ message: 'Job test-job paused successfully' });
			expect(mockAdminJobService.pauseJob).toHaveBeenCalledWith('test-job');
		});

		it('should disable a manual job', async () => {
			mockAdminJobService.pauseJob.mockResolvedValue(undefined);

			const result = await controller.pauseJob('manual-job', createMockRequest());

			expect(result).toEqual({ message: 'Job manual-job paused successfully' });
			expect(mockAdminJobService.pauseJob).toHaveBeenCalledWith('manual-job');
		});
	});

	describe('resumeJob', () => {
		it('should resume a scheduled job', async () => {
			mockAdminJobService.resumeJob.mockResolvedValue(undefined);

			const result = await controller.resumeJob('test-job', createMockRequest());

			expect(result).toEqual({ message: 'Job test-job resumed successfully' });
			expect(mockAdminJobService.resumeJob).toHaveBeenCalledWith('test-job');
		});

		it('should enable a manual job', async () => {
			mockAdminJobService.resumeJob.mockResolvedValue(undefined);

			const result = await controller.resumeJob('manual-job', createMockRequest());

			expect(result).toEqual({ message: 'Job manual-job resumed successfully' });
			expect(mockAdminJobService.resumeJob).toHaveBeenCalledWith('manual-job');
		});
	});
});

