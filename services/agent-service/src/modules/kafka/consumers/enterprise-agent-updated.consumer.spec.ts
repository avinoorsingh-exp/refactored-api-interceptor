import { Test, TestingModule } from '@nestjs/testing';
import { EnterpriseAgentUpdatedConsumer } from './enterprise-agent-updated.consumer.js';
import { KafkaClientService } from '../kafka-client.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';

describe('EnterpriseAgentUpdatedConsumer', () => {
	let consumer: EnterpriseAgentUpdatedConsumer;
	let mockKafkaClient: jest.Mocked<KafkaClientService>;
	let mockConfigService: jest.Mocked<ConfigService>;
	let mockLogger: jest.Mocked<LoggerService>;
	let mockConsumer: jest.Mocked<Consumer>;
	let mockKafka: jest.Mocked<Kafka>;

	beforeEach(async () => {
		mockConsumer = {
			connect: jest.fn().mockResolvedValue(undefined),
			disconnect: jest.fn().mockResolvedValue(undefined),
			subscribe: jest.fn().mockResolvedValue(undefined),
			run: jest.fn().mockResolvedValue(undefined),
		} as any;

		mockKafka = {
			consumer: jest.fn().mockReturnValue(mockConsumer),
		} as any;

		mockKafkaClient = {
			getClient: jest.fn().mockReturnValue(mockKafka),
		} as any;

		mockConfigService = {
			get: jest.fn().mockReturnValue('test-consumer-group'),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EnterpriseAgentUpdatedConsumer,
				{ provide: KafkaClientService, useValue: mockKafkaClient },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
			],
		}).compile();

		consumer = module.get<EnterpriseAgentUpdatedConsumer>(EnterpriseAgentUpdatedConsumer);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create consumer instance', () => {
			expect(consumer).toBeDefined();
		});

		it('should set logger context', () => {
			expect(mockLogger.setContext).toHaveBeenCalledWith('EnterpriseAgentUpdatedConsumer');
		});

		it('should get consumer group ID from config', () => {
			expect(mockConfigService.get).toHaveBeenCalledWith('KAFKA_CONSUMER_GROUP_ID');
		});
	});

	describe('start()', () => {
		it('should connect consumer to Kafka', async () => {
			await consumer.start();

			expect(mockKafka.consumer).toHaveBeenCalledWith({ groupId: 'test-consumer-group' });
			expect(mockConsumer.connect).toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Kafka consumer connected',
				expect.objectContaining({
					topic: 'Enterprise_AgentUpdated_V2',
					groupId: 'test-consumer-group',
				}),
			);
		});

		it('should subscribe to Enterprise_AgentUpdated_V2 topic', async () => {
			await consumer.start();

			expect(mockConsumer.subscribe).toHaveBeenCalledWith({
				topic: 'Enterprise_AgentUpdated_V2',
				fromBeginning: false,
			});
			expect(mockLogger.info).toHaveBeenCalledWith('Subscribed to topic', {
				topic: 'Enterprise_AgentUpdated_V2',
			});
		});

		it('should start message processing', async () => {
			await consumer.start();

			expect(mockConsumer.run).toHaveBeenCalledWith({
				eachMessage: expect.any(Function),
			});
			expect(mockLogger.info).toHaveBeenCalledWith('Enterprise Agent Updated consumer started successfully');
		});

		it('should throw error if connection fails', async () => {
			mockConsumer.connect.mockRejectedValueOnce(new Error('Connection failed'));

			await expect(consumer.start()).rejects.toThrow('Connection failed');
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Failed to start Kafka consumer',
				expect.any(Object),
			);
		});

		it('should log warning when consumer fails to start', async () => {
			mockConsumer.connect.mockRejectedValueOnce(new Error('Connection failed'));

			await expect(consumer.start()).rejects.toThrow();
			expect(mockLogger.warn).toHaveBeenCalledWith('Consumer will not process messages until Kafka is available');
		});
	});

	describe('stop()', () => {
		it('should disconnect consumer', async () => {
			await consumer.start();
			await consumer.stop();

			expect(mockConsumer.disconnect).toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith('Kafka consumer disconnected');
		});

		it('should handle disconnect errors gracefully', async () => {
			await consumer.start();
			mockConsumer.disconnect.mockRejectedValueOnce(new Error('Disconnect failed'));

			await expect(consumer.stop()).resolves.not.toThrow();
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Error disconnecting Kafka consumer',
				expect.any(Object),
			);
		});

		it('should not throw if consumer is not started', async () => {
			await expect(consumer.stop()).resolves.not.toThrow();
		});
	});

	describe('message handling', () => {
		let messageHandler: (params: { topic: string; partition: number; message: KafkaMessage }) => Promise<void>;

		beforeEach(async () => {
			await consumer.start();
			// Extract the message handler from the run call
			const runCall = mockConsumer.run.mock.calls[0][0];
			messageHandler = runCall.eachMessage;
		});

		it('should handle valid JSON message', async () => {
			const message: KafkaMessage = {
				offset: '123',
				key: Buffer.from('key-1'),
				value: Buffer.from(JSON.stringify({ agentId: '123', name: 'Test' })),
				timestamp: Date.now().toString(),
				attributes: 0,
				headers: {},
			};

			// Mock processAgentUpdate to avoid actual processing
			const processSpy = jest.spyOn(consumer as any, 'processAgentUpdate').mockResolvedValue(undefined);

			await messageHandler({ topic: 'Enterprise_AgentUpdated_V2', partition: 0, message });

			expect(mockLogger.info).toHaveBeenCalledWith('Received message', {
				topic: 'Enterprise_AgentUpdated_V2',
				partition: 0,
				offset: '123',
				key: 'key-1',
				timestamp: expect.any(String),
			});

			expect(processSpy).toHaveBeenCalledWith({ agentId: '123', name: 'Test' });
			expect(mockLogger.info).toHaveBeenCalledWith('Message processed successfully', {
				topic: 'Enterprise_AgentUpdated_V2',
				partition: 0,
				offset: '123',
			});

			processSpy.mockRestore();
		});

		it('should skip retry for invalid JSON messages', async () => {
			const message: KafkaMessage = {
				offset: '123',
				key: Buffer.from('key-1'),
				value: Buffer.from('invalid json'),
				timestamp: Date.now().toString(),
				attributes: 0,
				headers: {},
			};

			await messageHandler({ topic: 'Enterprise_AgentUpdated_V2', partition: 0, message });

			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Failed to parse message as JSON - skipping retry',
				expect.objectContaining({
					topic: 'Enterprise_AgentUpdated_V2',
					partition: 0,
					offset: '123',
				}),
			);
		});

		it('should retry failed message processing', async () => {
			const message: KafkaMessage = {
				offset: '123',
				key: Buffer.from('key-1'),
				value: Buffer.from(JSON.stringify({ agentId: '123' })),
				timestamp: Date.now().toString(),
				attributes: 0,
				headers: {},
			};

			const processSpy = jest
				.spyOn(consumer as any, 'processAgentUpdate')
				.mockRejectedValueOnce(new Error('Processing failed'))
				.mockRejectedValueOnce(new Error('Processing failed'))
				.mockResolvedValueOnce(undefined);

			jest.spyOn(consumer as any, 'sleep').mockResolvedValue(undefined);

			await messageHandler({ topic: 'Enterprise_AgentUpdated_V2', partition: 0, message });

			expect(processSpy).toHaveBeenCalledTimes(3);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Message processing failed, retrying',
				expect.objectContaining({
					attempt: 1,
					maxRetries: 3,
				}),
			);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Message processing failed, retrying',
				expect.objectContaining({
					attempt: 2,
					maxRetries: 3,
				}),
			);
			expect(mockLogger.info).toHaveBeenCalledWith('Message processed successfully after retry', {
				topic: 'Enterprise_AgentUpdated_V2',
				partition: 0,
				offset: '123',
				attempt: 3,
				totalAttempts: 3,
			});

			processSpy.mockRestore();
		});

		it('should log error after all retries exhausted', async () => {
			const message: KafkaMessage = {
				offset: '123',
				key: Buffer.from('key-1'),
				value: Buffer.from(JSON.stringify({ agentId: '123' })),
				timestamp: Date.now().toString(),
				attributes: 0,
				headers: {},
			};

			const processSpy = jest
				.spyOn(consumer as any, 'processAgentUpdate')
				.mockRejectedValue(new Error('Processing failed'));

			jest.spyOn(consumer as any, 'sleep').mockResolvedValue(undefined);

			await messageHandler({ topic: 'Enterprise_AgentUpdated_V2', partition: 0, message });

			expect(processSpy).toHaveBeenCalledTimes(3);
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Message processing failed after all retries',
				expect.objectContaining({
					attempt: 3,
					maxRetries: 3,
				}),
			);
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Error handling message - all retries exhausted',
				expect.objectContaining({
					topic: 'Enterprise_AgentUpdated_V2',
					partition: 0,
					offset: '123',
				}),
			);

			processSpy.mockRestore();
		});

		it('should use exponential backoff for retries', async () => {
			const message: KafkaMessage = {
				offset: '123',
				key: Buffer.from('key-1'),
				value: Buffer.from(JSON.stringify({ agentId: '123' })),
				timestamp: Date.now().toString(),
				attributes: 0,
				headers: {},
			};

			const processSpy = jest
				.spyOn(consumer as any, 'processAgentUpdate')
				.mockRejectedValue(new Error('Processing failed'));

			const sleepSpy = jest.spyOn(consumer as any, 'sleep').mockResolvedValue(undefined);

			await messageHandler({ topic: 'Enterprise_AgentUpdated_V2', partition: 0, message });

			// Check that sleep was called with exponential backoff delays
			expect(sleepSpy).toHaveBeenCalledWith(1000); // First retry: 1s
			expect(sleepSpy).toHaveBeenCalledWith(2000); // Second retry: 2s

			processSpy.mockRestore();
			sleepSpy.mockRestore();
		});
	});

	describe('onModuleInit()', () => {
		it('should call start on module initialization', async () => {
			const startSpy = jest.spyOn(consumer, 'start').mockResolvedValue(undefined);

			await consumer.onModuleInit();

			expect(startSpy).toHaveBeenCalled();

			startSpy.mockRestore();
		});
	});

	describe('onModuleDestroy()', () => {
		it('should call stop on module destruction', async () => {
			const stopSpy = jest.spyOn(consumer, 'stop').mockResolvedValue(undefined);

			await consumer.onModuleDestroy();

			expect(stopSpy).toHaveBeenCalled();

			stopSpy.mockRestore();
		});
	});
});


