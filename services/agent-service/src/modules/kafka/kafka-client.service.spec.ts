import { Test, TestingModule } from '@nestjs/testing';
import { KafkaClientService } from './kafka-client.service.js';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { Kafka } from 'kafkajs';

describe('KafkaClientService', () => {
	let service: KafkaClientService;
	let mockConfigService: jest.Mocked<ConfigService>;
	let mockLogger: jest.Mocked<LoggerService>;

	const mockConfig = {
		KAFKA_BROKERS: 'localhost:9092',
		KAFKA_CLIENT_ID: 'test-client',
		KAFKA_SSL: false,
		KAFKA_SASL_MECHANISM: 'plain' as const,
		KAFKA_SASL_USERNAME: 'test-user',
		KAFKA_SASL_PASSWORD: 'test-pass',
	};

	beforeEach(async () => {
		mockConfigService = {
			getAll: jest.fn().mockReturnValue(mockConfig),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				KafkaClientService,
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
			],
		}).compile();

		service = module.get<KafkaClientService>(KafkaClientService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create service instance', () => {
			expect(service).toBeDefined();
		});

		it('should set logger context', () => {
			expect(mockLogger.setContext).toHaveBeenCalledWith('KafkaClientService');
		});
	});

	describe('getClient()', () => {
		it('should return a Kafka client instance', () => {
			const client = service.getClient();
			expect(client).toBeInstanceOf(Kafka);
		});

		it('should return the same client instance on multiple calls', () => {
			const client1 = service.getClient();
			const client2 = service.getClient();
			expect(client1).toBe(client2);
		});

		it('should use configuration from ConfigService', () => {
			service.getClient();
			expect(mockConfigService.getAll).toHaveBeenCalled();
		});
	});

});


