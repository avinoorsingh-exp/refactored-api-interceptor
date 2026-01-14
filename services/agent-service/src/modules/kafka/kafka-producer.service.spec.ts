import { Test, TestingModule } from '@nestjs/testing';
import { KafkaProducerService } from './kafka-producer.service.js';
import { KafkaClientService } from './kafka-client.service.js';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { Producer, Kafka } from 'kafkajs';

describe('KafkaProducerService', () => {
	let service: KafkaProducerService;
	let mockKafkaClient: jest.Mocked<KafkaClientService>;
	let mockConfigService: jest.Mocked<ConfigService>;
	let mockLogger: jest.Mocked<LoggerService>;
	let mockProducer: jest.Mocked<Producer>;
	let mockKafka: jest.Mocked<Kafka>;

	beforeEach(async () => {
		mockProducer = {
			connect: jest.fn().mockResolvedValue(undefined),
			disconnect: jest.fn().mockResolvedValue(undefined),
			send: jest.fn().mockResolvedValue([
				{
					topicName: 'test-topic',
					partition: 0,
					errorCode: 0,
					offset: '0',
					timestamp: Date.now().toString(),
				},
			]),
		} as any;

		mockKafka = {
			producer: jest.fn().mockReturnValue(mockProducer),
		} as any;

		mockKafkaClient = {
			getClient: jest.fn().mockReturnValue(mockKafka),
		} as any;

		mockConfigService = {
			get: jest.fn().mockReturnValue('dev'), // Non-local environment
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				KafkaProducerService,
				{ provide: KafkaClientService, useValue: mockKafkaClient },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
			],
		}).compile();

		service = module.get<KafkaProducerService>(KafkaProducerService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create service instance', () => {
			expect(service).toBeDefined();
		});

		it('should set logger context', () => {
			expect(mockLogger.setContext).toHaveBeenCalledWith('KafkaProducerService');
		});
	});


	describe('sendMessage()', () => {
		beforeEach(async () => {
			// Manually connect producer for testing (skip onModuleInit)
			await (service as any).connect();
		});

		it('should send message to Kafka topic', async () => {
			const message = { test: 'data' };

			await service.sendMessage('test-topic', message, 'key-1');

			expect(mockProducer.send).toHaveBeenCalledWith({
				topic: 'test-topic',
				messages: [
					{
						key: 'key-1',
						value: JSON.stringify(message),
						headers: undefined,
					},
				],
			});
		});

		it('should log successful message send', async () => {
			const message = { test: 'data' };
			await service.sendMessage('test-topic', message, 'key-1');

			expect(mockLogger.info).toHaveBeenCalledWith('Message sent to Kafka topic', {
				topic: 'test-topic',
				key: 'key-1',
				hasHeaders: false,
			});
		});

		it('should handle string messages without JSON stringification', async () => {
			const message = 'string message';
			await service.sendMessage('test-topic', message);

			expect(mockProducer.send).toHaveBeenCalledWith({
				topic: 'test-topic',
				messages: [
					{
						key: undefined,
						value: 'string message',
						headers: undefined,
					},
				],
			});
		});

		it('should include headers when provided', async () => {
			const message = { test: 'data' };
			const headers = { 'correlation-id': 'abc-123' };

			await service.sendMessage('test-topic', message, undefined, headers);

			expect(mockProducer.send).toHaveBeenCalledWith({
				topic: 'test-topic',
				messages: [
					{
						key: undefined,
						value: JSON.stringify(message),
						headers,
					},
				],
			});
		});

		it('should attempt reconnection if producer not connected', async () => {
			// Reset producer to simulate disconnected state
			await (service as any).disconnect();
			mockProducer.connect.mockResolvedValueOnce(undefined);

			const message = { test: 'data' };
			await service.sendMessage('test-topic', message);

			expect(mockLogger.warn).toHaveBeenCalledWith('Kafka producer not connected, attempting to connect...');
			expect(mockProducer.connect).toHaveBeenCalled();
			expect(mockProducer.send).toHaveBeenCalled();
		});

		it('should throw error if reconnection fails', async () => {
			await (service as any).disconnect();
			mockProducer.connect.mockRejectedValueOnce(new Error('Connection failed'));

			const message = { test: 'data' };
			await expect(service.sendMessage('test-topic', message)).rejects.toThrow('Kafka producer is not available');
		});

		it('should throw error if producer is null', async () => {
			await (service as any).disconnect();
			mockProducer.connect.mockRejectedValueOnce(new Error('Connection failed'));

			const message = { test: 'data' };
			await expect(service.sendMessage('test-topic', message)).rejects.toThrow();
		});

		it('should mark producer as disconnected on send failure', async () => {
			mockProducer.send.mockRejectedValueOnce(new Error('Send failed'));

			const message = { test: 'data' };
			await expect(service.sendMessage('test-topic', message)).rejects.toThrow();

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Failed to send message to Kafka',
				expect.objectContaining({
					topic: 'test-topic',
				}),
			);
		});
	});

	describe('sendSponsorChangedMessage()', () => {
		beforeEach(async () => {
			// Manually connect producer for testing (skip onModuleInit)
			await (service as any).connect();
		});

		it('should send message to Global_SMS_SponsorChanged_V2 topic', async () => {
			const message = { agentId: '123', sponsorId: '456' };

			await service.sendSponsorChangedMessage(message, 'key-1');

			expect(mockProducer.send).toHaveBeenCalledWith({
				topic: 'Global_SMS_SponsorChanged_V2',
				messages: [
					{
						key: 'key-1',
						value: JSON.stringify(message),
						headers: undefined,
					},
				],
			});
		});

		it('should include headers when provided', async () => {
			const message = { agentId: '123' };
			const headers = { 'correlation-id': 'abc-123' };

			await service.sendSponsorChangedMessage(message, undefined, headers);

			expect(mockProducer.send).toHaveBeenCalledWith({
				topic: 'Global_SMS_SponsorChanged_V2',
				messages: [
					{
						key: undefined,
						value: JSON.stringify(message),
						headers,
					},
				],
			});
		});
	});

	describe('isConnected()', () => {
		it('should return false when producer is not connected', () => {
			expect(service.isConnected()).toBe(false);
		});

		it('should return true when producer is connected', async () => {
			await (service as any).connect();
			expect(service.isConnected()).toBe(true);
		});

		it('should return false after disconnect', async () => {
			await (service as any).connect();
			await (service as any).disconnect();
			expect(service.isConnected()).toBe(false);
		});
	});
});


