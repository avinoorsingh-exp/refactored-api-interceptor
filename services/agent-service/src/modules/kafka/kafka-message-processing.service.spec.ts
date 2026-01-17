import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { KafkaMessageProcessingEntity, KafkaMessageStatus } from '@exprealty/database';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';

describe('KafkaMessageProcessingService', () => {
	let service: KafkaMessageProcessingService;
	let mockRepository: jest.Mocked<Repository<KafkaMessageProcessingEntity>>;
	let mockDataSource: jest.Mocked<DataSource>;
	let mockQueryRunner: jest.Mocked<QueryRunner>;
	let mockLogger: jest.Mocked<LoggerService>;
	let mockMetrics: jest.Mocked<ReturnType<LoggerService['getMetrics']>>;
	let mockConfigService: jest.Mocked<ConfigService>;

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
		} as any;

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

			// Verify INSERT query was called with ON CONFLICT DO NOTHING
			const insertQueries = mockQueryRunner.query.mock.calls.filter((call) =>
				call[0].includes('INSERT INTO'),
			);
			expect(insertQueries.length).toBeGreaterThan(0);
			const insertQuery = insertQueries[0];
			expect(insertQuery[0]).toContain('ON CONFLICT');
			expect(insertQuery[0]).toContain('DO NOTHING');

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
				expect(query[0]).toContain('ON CONFLICT (topic, partition, offset)');
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
});

