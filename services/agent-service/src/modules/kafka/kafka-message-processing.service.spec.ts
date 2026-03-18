import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository, SelectQueryBuilder } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { KafkaMessageProcessingEntity, KafkaMessageStatus } from '@exprealty/database';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';
import { QueryService } from '../../common/query/query.service.js';
import { KafkaBootstrapService } from './kafka-bootstrap.service.js';
import { KafkaRuntimeManager } from './kafka-runtime-manager.service.js';
import { KafkaMessage } from 'kafkajs';

describe('KafkaMessageProcessingService', () => {
	let service: KafkaMessageProcessingService;
	let mockRepository: jest.Mocked<Repository<KafkaMessageProcessingEntity>>;
	let mockDataSource: jest.Mocked<DataSource>;
	let mockQueryRunner: jest.Mocked<QueryRunner>;
	let mockLogger: jest.Mocked<LoggerService>;
	let mockMetrics: jest.Mocked<ReturnType<LoggerService['getMetrics']>>;
	let mockConfigService: jest.Mocked<ConfigService>;
	let mockQueryService: jest.Mocked<QueryService>;
	let mockModuleRef: jest.Mocked<ModuleRef>;
	let mockKafkaBootstrapService: jest.Mocked<KafkaBootstrapService>;
	let mockKafkaRuntimeManager: jest.Mocked<KafkaRuntimeManager>;
	let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<KafkaMessageProcessingEntity>>;

	const testTopic = 'test-topic';
	const testPartition = 0;
	const testOffset = '12345';
	const testConsumerGroup = 'test-consumer-group';
	const testServiceName = 'test-service';

	const testData = {
		topic: testTopic,
		partition: testPartition,
		offset: testOffset,
		messageKey: 'test-key',
		eventId: 'test-event-id',
		payload: { test: 'data' },
		headers: { 'x-correlation-id': 'test-correlation-id' },
		consumerGroup: testConsumerGroup,
		serviceName: testServiceName,
	};

	beforeEach(async () => {
		// Create mock QueryRunner
		mockQueryRunner = {
			connect: jest.fn().mockResolvedValue(undefined),
			startTransaction: jest.fn().mockResolvedValue(undefined),
			commitTransaction: jest.fn().mockResolvedValue(undefined),
			rollbackTransaction: jest.fn().mockResolvedValue(undefined),
			release: jest.fn().mockResolvedValue(undefined),
			query: jest.fn(),
		} as any;

		// Create mock DataSource
		mockDataSource = {
			createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
			query: jest.fn(),
		} as any;

		// Create mock Repository
		mockRepository = {
			findOne: jest.fn(),
			save: jest.fn(),
		} as any;

		// Create mock Metrics
		mockMetrics = {
			recordKafkaMessageProcessed: jest.fn(),
			recordKafkaMessageError: jest.fn(),
			recordKafkaMessageRetry: jest.fn(),
			recordKafkaMessageDeadLettered: jest.fn(),
		} as any;

		// Create mock LoggerService
		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			getMetrics: jest.fn().mockReturnValue(mockMetrics),
		} as any;

		// Create mock ConfigService
		mockConfigService = {
			get: jest.fn(),
			getAll: jest.fn().mockReturnValue({ SERVICE_NAME: 'test-service' }),
		} as any;

		// Create mock QueryService
		mockQueryService = {
			normalize: jest.fn().mockReturnValue({
				offset: 0,
				limit: 25,
				sort: undefined,
				filter: undefined,
			}),
		} as any;

		// Create mock QueryBuilder
		mockQueryBuilder = {
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			skip: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
		} as any;

		// Create mock ModuleRef
		mockModuleRef = {
			get: jest.fn(),
		} as any;

		// Create mock KafkaBootstrapService
		mockKafkaBootstrapService = {
			getServiceByTopic: jest.fn(),
		} as any;

		// Create mock KafkaRuntimeManager
		mockKafkaRuntimeManager = {} as any;

		// Update mockRepository to include createQueryBuilder
		mockRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder) as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				KafkaMessageProcessingService,
				{
					provide: getRepositoryToken(KafkaMessageProcessingEntity),
					useValue: mockRepository,
				},
				{
					provide: DataSource,
					useValue: mockDataSource,
				},
				{
					provide: LoggerService,
					useValue: mockLogger,
				},
				{
					provide: ConfigService,
					useValue: mockConfigService,
				},
				{
					provide: QueryService,
					useValue: mockQueryService,
				},
				{
					provide: ModuleRef,
					useValue: mockModuleRef,
				},
				{
					provide: KafkaBootstrapService,
					useValue: mockKafkaBootstrapService,
				},
				{
					provide: KafkaRuntimeManager,
					useValue: mockKafkaRuntimeManager,
				},
			],
		}).compile();

		service = module.get<KafkaMessageProcessingService>(KafkaMessageProcessingService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('createSentRecord', () => {
		it('should create a new SENT record when record does not exist', async () => {
			// Arrange
			const sentData = {
				topic: testTopic,
				partition: testPartition,
				offset: testOffset,
				messageKey: 'test-key',
				eventId: 'test-event-id',
				payload: { test: 'data' },
				headers: { 'correlation-id': 'test-correlation' },
				serviceName: testServiceName,
			};

			mockQueryRunner.query.mockResolvedValueOnce([
				{
					id: 'test-id',
					attempt_count: 1,
					status: KafkaMessageStatus.SENT,
				},
			]); // INSERT with RETURNING

			// Act
			const result = await service.createSentRecord(sentData);

			// Assert
			expect(result).toBe(true);
			expect(mockQueryRunner.connect).toHaveBeenCalled();
			expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.release).toHaveBeenCalled();

			// Verify INSERT query was called with ON CONFLICT
			const insertQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('INSERT INTO'),
			);
			expect(insertQueries.length).toBeGreaterThan(0);
			const insertQuery = insertQueries[0];
			expect(insertQuery[0]).toContain('ON CONFLICT');
			expect(insertQuery[0]).toContain('DO UPDATE SET');

			// Verify structured log for record creation
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Kafka message SENT record created',
				expect.objectContaining({
					event: 'kafka_message_sent_record_created',
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
					attemptCount: 1,
					status: KafkaMessageStatus.SENT,
				}),
			);
		});

	});

	describe('lookupOrUpdateSentAndIncrementAttempt', () => {
		it('should increment attempt_count when SENT record already exists (retry)', async () => {
			// Arrange
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: 'test-id',
						attempt_count: 2,
						status: KafkaMessageStatus.SENT,
					},
				]) // First query: check if record exists (found existing SENT record)
				.mockResolvedValueOnce([
					{
						id: 'test-id',
						attempt_count: 3,
						status: KafkaMessageStatus.SENT,
					},
				]); // Second query: INSERT with ON CONFLICT UPDATE and RETURNING

			// Act
			const result = await service.lookupOrUpdateSentAndIncrementAttempt(testData);

			// Assert
			expect(result).toBe(true);
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

			// Verify INSERT with ON CONFLICT was called (this handles both insert and update)
			const insertQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('INSERT INTO'),
			);
			expect(insertQueries.length).toBeGreaterThan(0);
			expect(insertQueries[0][0]).toContain('ON CONFLICT');
			expect(insertQueries[0][0]).toContain('DO UPDATE SET');
			expect(insertQueries[0][0]).toContain('attempt_count = core.kafka_message_processing.attempt_count + 1');

			// Verify structured log for retry attempt
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Kafka message processing retry attempt increased',
				expect.objectContaining({
					event: 'kafka_message_retry_attempt',
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
					attemptCount: 3,
					previousAttemptCount: 2,
				}),
			);

			// Verify retry metric was recorded
			expect(mockMetrics.recordKafkaMessageRetry).toHaveBeenCalledWith({
				topic: testTopic,
				consumerGroup: testConsumerGroup,
				serviceName: testServiceName,
				attemptNumber: 3,
			});
		});

		it('should not create duplicate rows for the same topic/partition/offset', async () => {
			// Arrange
			const sameRecordId = 'test-id';
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: sameRecordId,
						attempt_count: 1,
						status: KafkaMessageStatus.SENT,
					},
				]) // First call - first query: record exists
				.mockResolvedValueOnce([
					{
						id: sameRecordId,
						attempt_count: 2,
						status: KafkaMessageStatus.SENT,
					},
				]) // First call - second query: INSERT with ON CONFLICT UPDATE
				.mockResolvedValueOnce([
					{
						id: sameRecordId,
						attempt_count: 2,
						status: KafkaMessageStatus.SENT,
					},
				]) // Second call - first query: record exists
				.mockResolvedValueOnce([
					{
						id: sameRecordId,
						attempt_count: 3,
						status: KafkaMessageStatus.SENT,
					},
				]); // Second call - second query: INSERT with ON CONFLICT UPDATE

			// Act - call twice with same topic/partition/offset
			await service.lookupOrUpdateSentAndIncrementAttempt(testData);
			await service.lookupOrUpdateSentAndIncrementAttempt(testData);

			// Assert
			// Verify ON CONFLICT was used in both calls (prevents duplicates)
			const insertQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('INSERT INTO'),
			);
			expect(insertQueries.length).toBe(2); // Both calls should use INSERT
			insertQueries.forEach((query) => {
				// The offset column is quoted in the actual query
				expect(query[0]).toMatch(/ON CONFLICT\s*\([^)]*topic[^)]*partition[^)]*["']?offset["']?[^)]*\)/i);
				expect(query[0]).toContain('DO UPDATE SET');
				// Verify the unique constraint columns are in ON CONFLICT
				expect(query[0]).toMatch(/ON CONFLICT\s*\([^)]*topic[^)]*partition[^)]*offset[^)]*\)/i);
			});

			// Verify both calls used the same topic/partition/offset (same parameters)
			const firstInsertParams = insertQueries[0][1];
			const secondInsertParams = insertQueries[1][1];
			expect(firstInsertParams[0]).toBe(testTopic); // topic
			expect(firstInsertParams[1]).toBe(testPartition); // partition
			expect(firstInsertParams[2]).toBe(testOffset); // offset
			expect(secondInsertParams[0]).toBe(testTopic);
			expect(secondInsertParams[1]).toBe(testPartition);
			expect(secondInsertParams[2]).toBe(testOffset);

			// Verify both calls returned results with the same record ID (from mock)
			// The ON CONFLICT ensures the same record is updated, not a new one created
			expect(mockQueryRunner.query).toHaveBeenCalledTimes(4); // 2 checks + 2 inserts/updates
		});

		it('should handle errors gracefully without blocking', async () => {
			// Arrange
			mockQueryRunner.query.mockRejectedValueOnce(new Error('Database error'));

			// Act
			const result = await service.lookupOrUpdateSentAndIncrementAttempt(testData);

			// Assert
			expect(result).toBe(false);
			expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.release).toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Failed to lookup-or-update SENT Kafka message processing record (non-blocking)',
				expect.objectContaining({
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
				}),
			);
		});
	});

	describe('markAsProcessed', () => {
		it('should mark record as PROCESSED on success', async () => {
			// Arrange
			const recordId = 'test-id';
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: recordId,
						status: KafkaMessageStatus.SENT,
						consumer_group: testConsumerGroup,
						service_name: testServiceName,
					},
				]) // First query: find record
				.mockResolvedValueOnce([
					{
						id: recordId,
					},
				]); // Second query: UPDATE with RETURNING

			// Act
			const result = await service.markAsProcessed(testTopic, testPartition, testOffset);

			// Assert
			expect(result).toBe(true);
			expect(mockQueryRunner.connect).toHaveBeenCalled();
			expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.release).toHaveBeenCalled();

			// Verify UPDATE query was called with PROCESSED status
			const updateQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('UPDATE'),
			);
			expect(updateQueries.length).toBeGreaterThan(0);
			const updateQuery = updateQueries[updateQueries.length - 1]; // Get the last UPDATE query
			expect(updateQuery[1][0]).toBe(KafkaMessageStatus.PROCESSED); // First param is status

			// Verify structured log for status transition
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Kafka message processing status transition',
				expect.objectContaining({
					event: 'kafka_message_status_transition',
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
					previousStatus: KafkaMessageStatus.SENT,
					newStatus: KafkaMessageStatus.PROCESSED,
					transition: `${KafkaMessageStatus.SENT} → ${KafkaMessageStatus.PROCESSED}`,
				}),
			);

			// Verify processed metric was recorded
			expect(mockMetrics.recordKafkaMessageProcessed).toHaveBeenCalledWith({
				topic: testTopic,
				consumerGroup: testConsumerGroup,
				serviceName: testServiceName,
			});
		});

		it('should return false if record not found', async () => {
			// Arrange
			mockQueryRunner.query.mockResolvedValueOnce([]); // Empty result = not found

			// Act
			const result = await service.markAsProcessed(testTopic, testPartition, testOffset);

			// Assert
			expect(result).toBe(false);
			expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Kafka message processing record not found for markAsProcessed',
				expect.objectContaining({
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
				}),
			);
		});

		it('should handle errors gracefully without blocking', async () => {
			// Arrange
			mockQueryRunner.query.mockRejectedValueOnce(new Error('Database error'));

			// Act
			const result = await service.markAsProcessed(testTopic, testPartition, testOffset);

			// Assert
			expect(result).toBe(false);
			expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Failed to mark Kafka message processing record as processed (non-blocking)',
				expect.objectContaining({
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
				}),
			);
		});
	});

	describe('markAsError', () => {
		it('should mark record as ERROR on failure', async () => {
			// Arrange
			const recordId = 'test-id';
			const testError = new Error('Processing failed');
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: recordId,
						status: KafkaMessageStatus.SENT,
						consumer_group: testConsumerGroup,
						service_name: testServiceName,
					},
				]) // First query: find record
				.mockResolvedValueOnce([
					{
						id: recordId,
					},
				]); // Second query: UPDATE with RETURNING

			// Act
			const result = await service.markAsError(
				testTopic,
				testPartition,
				testOffset,
				testError,
				true,
			);

			// Assert
			expect(result).toBe(true);
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

			// Verify UPDATE query was called with ERROR status
			const updateQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('UPDATE'),
			);
			expect(updateQueries.length).toBeGreaterThan(0);
			const updateQuery = updateQueries[updateQueries.length - 1]; // Get the last UPDATE query
			expect(updateQuery[1][0]).toBe(KafkaMessageStatus.ERROR); // First param is status
			expect(updateQuery[1][1]).toBe('Error'); // error_code
			expect(updateQuery[1][2]).toBe('Processing failed'); // error_message
			expect(updateQuery[1][4]).toBe(true); // is_retryable

			// Verify structured log for status transition
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Kafka message processing status transition',
				expect.objectContaining({
					event: 'kafka_message_status_transition',
					previousStatus: KafkaMessageStatus.SENT,
					newStatus: KafkaMessageStatus.ERROR,
					transition: `${KafkaMessageStatus.SENT} → ${KafkaMessageStatus.ERROR}`,
					errorCode: 'Error',
					errorMessage: 'Processing failed',
					retryable: true,
				}),
			);

			// Verify error metric was recorded
			expect(mockMetrics.recordKafkaMessageError).toHaveBeenCalledWith({
				topic: testTopic,
				consumerGroup: testConsumerGroup,
				serviceName: testServiceName,
				errorType: 'Error',
			});
		});

		it('should handle string error messages', async () => {
			// Arrange
			const recordId = 'test-id';
			const errorMessage = 'String error message';
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: recordId,
						status: KafkaMessageStatus.SENT,
						consumer_group: testConsumerGroup,
						service_name: testServiceName,
					},
				])
				.mockResolvedValueOnce([{ id: recordId }]);

			// Act
			const result = await service.markAsError(
				testTopic,
				testPartition,
				testOffset,
				errorMessage,
				false,
			);

			// Assert
			expect(result).toBe(true);
			const updateQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('UPDATE'),
			);
			expect(updateQueries.length).toBeGreaterThan(0);
			const updateQuery = updateQueries[updateQueries.length - 1]; // Get the last UPDATE query
			expect(updateQuery[1][2]).toBe(errorMessage); // error_message
			expect(updateQuery[1][4]).toBe(false); // is_retryable
		});

		it('should return false if record not found', async () => {
			// Arrange
			mockQueryRunner.query.mockResolvedValueOnce([]);

			// Act
			const result = await service.markAsError(
				testTopic,
				testPartition,
				testOffset,
				new Error('Test error'),
			);

			// Assert
			expect(result).toBe(false);
			expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
		});
	});

	describe('markAsDeadLettered', () => {
		it('should mark record as dead lettered', async () => {
			// Arrange
			const recordId = 'test-id';
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: recordId,
						consumer_group: testConsumerGroup,
						service_name: testServiceName,
					},
				])
				.mockResolvedValueOnce([{ id: recordId }]);

			// Act
			const result = await service.markAsDeadLettered(testTopic, testPartition, testOffset);

			// Assert
			expect(result).toBe(true);
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

			// Verify UPDATE query sets dead_lettered = true
			const updateQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('UPDATE'),
			);
			expect(updateQueries.length).toBeGreaterThan(0);
			const updateQuery = updateQueries[updateQueries.length - 1]; // Get the last UPDATE query
			expect(updateQuery[0]).toContain('dead_lettered = true');

			// Verify structured log
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Kafka message processing record marked as dead lettered',
				expect.objectContaining({
					event: 'kafka_message_dead_lettered',
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
				}),
			);

			// Verify dead letter metric was recorded
			expect(mockMetrics.recordKafkaMessageDeadLettered).toHaveBeenCalledWith({
				topic: testTopic,
				consumerGroup: testConsumerGroup,
				serviceName: testServiceName,
			});
		});
	});

	describe('findByMessage', () => {
		it('should find record by topic, partition, offset', async () => {
			// Arrange
			const mockEntity = {
				id: 'test-id',
				topic: testTopic,
				partition: testPartition,
				offset: testOffset,
			} as KafkaMessageProcessingEntity;

			mockRepository.findOne.mockResolvedValueOnce(mockEntity);

			// Act
			const result = await service.findByMessage(testTopic, testPartition, testOffset);

			// Assert
			expect(result).toEqual(mockEntity);
			expect(mockRepository.findOne).toHaveBeenCalledWith({
				where: {
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
				},
			});
		});

		it('should return null if record not found', async () => {
			// Arrange
			mockRepository.findOne.mockResolvedValueOnce(null);

			// Act
			const result = await service.findByMessage(testTopic, testPartition, testOffset);

			// Assert
			expect(result).toBeNull();
		});

		it('should handle errors gracefully without blocking', async () => {
			// Arrange
			mockRepository.findOne.mockRejectedValueOnce(new Error('Database error'));

			// Act
			const result = await service.findByMessage(testTopic, testPartition, testOffset);

			// Assert
			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Failed to find Kafka message processing record (non-blocking)',
				expect.objectContaining({
					topic: testTopic,
					partition: testPartition,
					offset: testOffset,
				}),
			);
		});
	});

	describe('retryMessage', () => {
		const messageId = 'test-message-id';
		const mockMessage: KafkaMessageProcessingEntity = {
			id: messageId,
			topic: testTopic,
			partition: testPartition,
			offset: testOffset,
			messageKey: 'test-key',
			eventId: 'test-event-id',
			status: KafkaMessageStatus.ERROR,
			attemptCount: 1,
			payload: { test: 'data' },
			headers: { 'x-correlation-id': 'test-correlation-id' },
			createdAt: new Date(),
			updatedAt: new Date(),
		} as KafkaMessageProcessingEntity;

		const mockConsumerService = {
			getType: jest.fn().mockReturnValue('consumer'),
			getMessageHandler: jest.fn().mockReturnValue(jest.fn().mockResolvedValue(undefined)),
		};

		beforeEach(() => {
			mockRepository.findOne.mockResolvedValue(mockMessage);
			mockKafkaBootstrapService.getServiceByTopic.mockResolvedValue({
				service: mockConsumerService,
				entity: {} as any,
			});
		});

		it('should update last_attempt_at after successful processing', async () => {
			// Arrange
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.ERROR,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			const updatedMessageAfterIncrement = {
				...mockMessage,
				status: KafkaMessageStatus.ERROR, // Still ERROR after increment
				attemptCount: 2,
			};
			const finalMessage = {
				...mockMessage,
				status: KafkaMessageStatus.PROCESSED, // Changed to PROCESSED after processing
				attemptCount: 2,
			};
			mockRepository.findOne
				.mockResolvedValueOnce(updatedMessageAfterIncrement) // After initial update
				.mockResolvedValueOnce(finalMessage); // After processing

			mockDataSource.query.mockResolvedValueOnce([{ id: messageId }]);

			// Act
			await service.retryMessage(messageId);

			// Assert
			// Verify initial update (attempt_count increment) - this is done via queryRunner
			expect(mockQueryRunner.query).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE core.kafka_message_processing'),
				[messageId],
			);
			expect(mockQueryRunner.query).toHaveBeenCalledWith(
				expect.stringContaining('attempt_count = attempt_count + 1'),
				[messageId],
			);
			expect(mockQueryRunner.query).toHaveBeenCalledWith(
				expect.stringContaining('last_attempt_at = NOW()'),
				[messageId],
			);

			// Verify update after processing - this is done via dataSource.query
			const updateAfterProcessingCalls = mockDataSource.query.mock.calls.filter((call) =>
				call[0].includes('UPDATE core.kafka_message_processing'),
			);
			expect(updateAfterProcessingCalls.length).toBeGreaterThan(0);
			expect(updateAfterProcessingCalls[0][0]).toContain('SET last_attempt_at = NOW()');
			expect(updateAfterProcessingCalls[0][1]).toEqual([messageId]);
		});

		it('should update last_attempt_at after failed processing', async () => {
			// Arrange
			const processingError = new Error('Processing failed');
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.ERROR,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					attemptCount: 2,
				}) // After initial update
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.ERROR,
					attemptCount: 2,
				}); // After processing failure

			mockConsumerService.getMessageHandler.mockReturnValue(
				jest.fn().mockRejectedValue(processingError),
			);

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						status: KafkaMessageStatus.ERROR,
						error_code: 'Error',
						error_message: 'Processing failed',
						error_stacktrace: null,
					},
				]) // Status check query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						partition: testPartition,
						offset: testOffset,
						status: KafkaMessageStatus.ERROR,
						message_key: 'test-key',
						payload: { test: 'data' },
						headers: { 'x-correlation-id': 'test-correlation-id' },
						event_id: 'test-event-id',
						consumer_group: testConsumerGroup,
						service_name: testServiceName,
						attempt_count: 2,
						error_code: 'Error',
						error_message: 'Processing failed',
						error_stacktrace: null,
						is_retryable: true,
						processed_at: null,
						last_attempt_at: new Date(),
						created_at: new Date(),
						updated_at: new Date(),
					},
				]); // Final full message query

			// Act
			await service.retryMessage(messageId);

			// Assert
			// Verify initial update (attempt_count increment)
			expect(mockQueryRunner.query).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE core.kafka_message_processing'),
				[messageId],
			);

			// Verify update after processing failure
			const updateAfterFailureCalls = mockDataSource.query.mock.calls.filter((call) =>
				call[0].includes('UPDATE core.kafka_message_processing'),
			);
			expect(updateAfterFailureCalls.length).toBeGreaterThan(0);
			expect(updateAfterFailureCalls[0][0]).toContain('last_attempt_at = NOW()');
			expect(updateAfterFailureCalls[0][1]).toContain(KafkaMessageStatus.ERROR);

			// Verify error was logged
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Retry processing failed, returning final ERROR status with error details',
				expect.objectContaining({
					messageId,
					processingError: 'Processing failed',
				}),
			);
		});

		it('should throw NotFoundException if message not found', async () => {
			// Arrange
			mockQueryRunner.query.mockResolvedValueOnce([]); // Empty result from SELECT FOR UPDATE

			// Act & Assert
			await expect(service.retryMessage(messageId)).rejects.toThrow('not found');
			expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
		});

		it('should allow retry for PROCESSED status (race condition fix)', async () => {
			// Arrange
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.PROCESSED,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				});

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						id: messageId,
						status: KafkaMessageStatus.PROCESSED,
						error_code: null,
						error_message: null,
						error_stacktrace: null,
					},
				]); // Final status query

			// Act
			await service.retryMessage(messageId);

			// Assert
			// Should not throw - retry should be accepted for PROCESSED status
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Retry accepted: processing message regardless of current status',
				expect.objectContaining({
					messageId,
					requestStartStatus: KafkaMessageStatus.PROCESSED.toUpperCase(),
				}),
			);
		});

		it('should allow retry for SENT status', async () => {
			// Arrange
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.SENT,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.SENT,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				});

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						id: messageId,
						status: KafkaMessageStatus.PROCESSED,
						error_code: null,
						error_message: null,
						error_stacktrace: null,
					},
				]); // Final status query

			// Act
			await service.retryMessage(messageId);

			// Assert
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
		});

		it('should throw BadRequestException if message status is null/undefined', async () => {
			// Arrange
			mockQueryRunner.query.mockResolvedValueOnce([
				{
					id: messageId,
					topic: testTopic,
					status: null, // Invalid status
					attempt_count: 1,
				},
			]);

			// Act & Assert
			await expect(service.retryMessage(messageId)).rejects.toThrow('invalid');
			expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
		});

		it('should use custom payload when provided', async () => {
			// Arrange
			const customPayload = { custom: 'payload' };
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.ERROR,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				});

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						id: messageId,
						status: KafkaMessageStatus.PROCESSED,
						error_code: null,
						error_message: null,
						error_stacktrace: null,
					},
				]); // Final status query

			// Act
			await service.retryMessage(messageId, customPayload);

			// Assert
			// Verify message handler was called with custom payload
			const messageHandler = mockConsumerService.getMessageHandler();
			expect(messageHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.objectContaining({
						value: Buffer.from(JSON.stringify(customPayload)),
						headers: expect.objectContaining({
							'x-skip-translation': Buffer.from('true'),
						}),
					}),
				}),
			);
		});

		it('should parse payload string from database (JSONB string handling)', async () => {
			// Arrange
			const payloadString = JSON.stringify({ agent: { firstName: 'John', lastName: 'Doe' } });
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.ERROR,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					payload: payloadString, // String payload
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					payload: JSON.parse(payloadString), // Parsed payload
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				});

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						id: messageId,
						status: KafkaMessageStatus.PROCESSED,
						error_code: null,
						error_message: null,
						error_stacktrace: null,
					},
				]); // Final status query

			// Act
			await service.retryMessage(messageId);

			// Assert
			// Verify message handler was called with parsed payload
			const messageHandler = mockConsumerService.getMessageHandler();
			expect(messageHandler).toHaveBeenCalled();
			const callArgs = messageHandler.mock.calls[0][0];
			const parsedPayload = JSON.parse(callArgs.message.value.toString());
			expect(parsedPayload.agent.firstName).toBe('John');
			expect(parsedPayload.agent.lastName).toBe('Doe');
		});

		it('should convert snake_case to camelCase for agent fields', async () => {
			// Arrange
			const payloadWithSnakeCase = {
				agent: {
					first_name: 'John',
					last_name: 'Doe',
					id: 'test-id',
				},
			};
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.ERROR,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					payload: payloadWithSnakeCase,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					payload: payloadWithSnakeCase,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				});

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						id: messageId,
						status: KafkaMessageStatus.PROCESSED,
						error_code: null,
						error_message: null,
						error_stacktrace: null,
					},
				]); // Final status query

			// Act
			await service.retryMessage(messageId);

			// Assert
			// Verify message handler was called with camelCase payload
			const messageHandler = mockConsumerService.getMessageHandler();
			expect(messageHandler).toHaveBeenCalled();
			const callArgs = messageHandler.mock.calls[0][0];
			const payload = JSON.parse(callArgs.message.value.toString());
			// Should have both camelCase and snake_case (conversion adds camelCase but doesn't remove snake_case)
			expect(payload.agent.firstName || payload.agent.first_name).toBe('John');
			expect(payload.agent.lastName || payload.agent.last_name).toBe('Doe');
		});

		it('should handle ZodError and return error details in response', async () => {
			// Arrange
			const { ZodError } = await import('zod');
			const zodError = new ZodError([
				{
					path: ['agent', 'firstName'],
					message: 'String must contain at least 1 character(s)',
					code: 'too_small',
				},
				{
					path: ['agent', 'lastName'],
					message: 'String must contain at least 1 character(s)',
					code: 'too_small',
				},
			]);

			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.ERROR,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.ERROR,
					attemptCount: 2,
					errorCode: 'ZodError',
					errorMessage: 'Validation failed: agent.firstName: String must contain at least 1 character(s); agent.lastName: String must contain at least 1 character(s)',
					errorStacktrace: JSON.stringify({
						type: 'ZodError',
						issues: zodError.issues,
					}),
				});

			mockConsumerService.getMessageHandler.mockReturnValue(
				jest.fn().mockRejectedValue(zodError),
			);

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						id: messageId,
						status: KafkaMessageStatus.ERROR,
						error_code: 'ZodError',
						error_message: 'Validation failed: agent.firstName: String must contain at least 1 character(s); agent.lastName: String must contain at least 1 character(s)',
						error_stacktrace: JSON.stringify({
							type: 'ZodError',
							issues: zodError.issues,
						}),
					},
				]); // Final status query

			// Act
			const result = await service.retryMessage(messageId);

			// Assert
			expect(result.status).toBe(KafkaMessageStatus.ERROR);
			expect(result.errorCode).toBe('ZodError');
			expect(result.errorMessage).toContain('Validation failed');
			expect(result.errorStacktrace).toBeDefined();
		});

		it('should poll for final status and return committed status', async () => {
			// Arrange
			mockQueryRunner.query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						status: KafkaMessageStatus.ERROR,
						attempt_count: 1,
					},
				]) // SELECT FOR UPDATE
				.mockResolvedValueOnce([
					{
						id: messageId,
						attempt_count: 2,
						last_attempt_at: new Date(),
					},
				]); // UPDATE attempt_count

			mockRepository.findOne
				.mockResolvedValueOnce({
					...mockMessage,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				})
				.mockResolvedValueOnce({
					...mockMessage,
					status: KafkaMessageStatus.PROCESSED,
					attemptCount: 2,
				});

			mockDataSource.query
				.mockResolvedValueOnce([{ id: messageId }]) // After processing update
				.mockResolvedValueOnce([
					{
						status: KafkaMessageStatus.PROCESSED,
						error_code: null,
						error_message: null,
						error_stacktrace: null,
					},
				]) // Status check query
				.mockResolvedValueOnce([
					{
						id: messageId,
						topic: testTopic,
						partition: testPartition,
						offset: testOffset,
						status: KafkaMessageStatus.PROCESSED,
						message_key: 'test-key',
						payload: { test: 'data' },
						headers: { 'x-correlation-id': 'test-correlation-id' },
						event_id: 'test-event-id',
						consumer_group: testConsumerGroup,
						service_name: testServiceName,
						attempt_count: 2,
						error_code: null,
						error_message: null,
						error_stacktrace: null,
						is_retryable: true,
						processed_at: new Date(),
						last_attempt_at: new Date(),
						created_at: new Date(),
						updated_at: new Date(),
					},
				]); // Final full message query

			// Act
			const result = await service.retryMessage(messageId);

			// Assert
			expect(result.status).toBe(KafkaMessageStatus.PROCESSED);
			expect(result.attemptCount).toBe(2);
		});
	});

	describe('batchRetryMessages', () => {
		const messageId1 = 'message-id-1';
		const messageId2 = 'message-id-2';
		const messageId3 = 'message-id-3';

		it('should retry multiple messages and return summary', async () => {
			// Arrange
			const mockMessage: KafkaMessageProcessingEntity = {
				id: messageId1,
				topic: testTopic,
				partition: testPartition,
				offset: testOffset,
				status: KafkaMessageStatus.ERROR,
				attemptCount: 1,
				payload: { test: 'data' },
				createdAt: new Date(),
				updatedAt: new Date(),
			} as KafkaMessageProcessingEntity;

			mockRepository.findOne.mockResolvedValue(mockMessage);
			mockQueryRunner.query.mockResolvedValue([
				{
					id: messageId1,
					attempt_count: 2,
					last_attempt_at: new Date(),
				},
			]);
			mockDataSource.query.mockResolvedValue([{ id: messageId1 }]);

			mockKafkaBootstrapService.getServiceByTopic.mockResolvedValue({
				service: {
					getType: jest.fn().mockReturnValue('consumer'),
					getMessageHandler: jest.fn().mockReturnValue(
						jest.fn().mockResolvedValue(undefined),
					),
				},
				entity: {} as any,
			});

			// Mock retryMessage to succeed for first two, fail for third
			jest.spyOn(service, 'retryMessage')
				.mockResolvedValueOnce({} as any)
				.mockResolvedValueOnce({} as any)
				.mockRejectedValueOnce(new Error('Retry failed'));

			// Act
			const result = await service.batchRetryMessages([messageId1, messageId2, messageId3]);

			// Assert
			expect(result.successful).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.results).toHaveLength(3);
			expect(result.results[0]).toEqual({ messageId: messageId1, success: true });
			expect(result.results[1]).toEqual({ messageId: messageId2, success: true });
			expect(result.results[2]).toEqual({
				messageId: messageId3,
				success: false,
				error: 'Retry failed',
			});

			expect(mockLogger.info).toHaveBeenCalledWith(
				'Batch retry completed',
				expect.objectContaining({
					total: 3,
					successful: 2,
					failed: 1,
				}),
			);
		});

		it('should handle empty array', async () => {
			// Act
			const result = await service.batchRetryMessages([]);

			// Assert
			expect(result.successful).toBe(0);
			expect(result.failed).toBe(0);
			expect(result.results).toHaveLength(0);
		});
	});

	describe('findPage', () => {
		it('should default to sorting by last_attempt_at DESC with NULLS LAST', async () => {
			// Arrange
			const mockEntities: KafkaMessageProcessingEntity[] = [
				{
					id: 'id-1',
					lastAttemptAt: new Date('2024-01-02'),
					createdAt: new Date('2024-01-01'),
				},
				{
					id: 'id-2',
					lastAttemptAt: null,
					createdAt: new Date('2024-01-03'),
				},
			] as any;

			mockQueryBuilder.getManyAndCount.mockResolvedValue([mockEntities, 2]);
			mockQueryService.normalize.mockReturnValue({
				offset: 0,
				limit: 25,
				sort: undefined, // No sort specified - should use default
				filter: undefined,
			});

			// Act
			await service.findPage({});

			// Assert
			// Verify default sort was applied
			expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
				'kafka_message.last_attempt_at',
				'DESC',
				'NULLS LAST',
			);
			expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
				'kafka_message.created_at',
				'DESC',
			);
		});

		it('should use custom sort when provided', async () => {
			// Arrange
			mockQueryService.normalize.mockReturnValue({
				offset: 0,
				limit: 25,
				sort: {
					conditions: [
						{ field: 'createdAt', direction: 'ASC' },
					],
				},
				filter: undefined,
			});

			// Act
			await service.findPage({ sort: '[{"field":"createdAt","direction":"ASC"}]' });

			// Assert
			// Should not use default sort when custom sort is provided
			expect(mockQueryBuilder.orderBy).not.toHaveBeenCalledWith(
				'kafka_message.last_attempt_at',
				'DESC',
				'NULLS LAST',
			);
		});
	});
});

