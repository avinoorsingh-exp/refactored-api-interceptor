import { Test, TestingModule } from '@nestjs/testing';
import { AuAgentDetailsAgentUpdatedConsumer } from './au-agent-details-agent-updated.consumer.js';
import { KafkaClientService } from '../kafka-client.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { KafkaMessageProcessingService } from '../kafka-message-processing.service.js';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';

describe('AuAgentDetailsAgentUpdatedConsumer', () => {
	let consumer: AuAgentDetailsAgentUpdatedConsumer;
	let mockKafkaClient: jest.Mocked<KafkaClientService>;
	let mockConfigService: jest.Mocked<ConfigService>;
	let mockLogger: jest.Mocked<LoggerService>;
	let mockKafkaMessageProcessingService: jest.Mocked<KafkaMessageProcessingService>;
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
			getAll: jest.fn().mockReturnValue({ SERVICE_NAME: 'agent-service' }),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		mockKafkaMessageProcessingService = {
			lookupOrUpdateSentAndIncrementAttempt: jest.fn().mockResolvedValue(true),
			markAsProcessed: jest.fn().mockResolvedValue(undefined),
			markAsError: jest.fn().mockResolvedValue(undefined),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuAgentDetailsAgentUpdatedConsumer,
				{ provide: KafkaClientService, useValue: mockKafkaClient },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
				{ provide: KafkaMessageProcessingService, useValue: mockKafkaMessageProcessingService },
			],
		}).compile();

		consumer = module.get<AuAgentDetailsAgentUpdatedConsumer>(AuAgentDetailsAgentUpdatedConsumer);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create consumer instance', () => {
			expect(consumer).toBeDefined();
		});

		it('should set logger context', () => {
			expect(mockLogger.setContext).toHaveBeenCalledWith('AuAgentDetailsAgentUpdatedConsumer');
		});
	});

	describe('translateKafkaMessageToUpsertData', () => {
		it('should translate basic agent fields', () => {
			const payload = {
				Uuid: '550e8400-e29b-41d4-a716-446655440000',
				SourceSystemKey: 564,
				SourceSystemId: 3,
				FirstName: 'Auu',
				LastName: 'Test',
				MiddleName: 'MM',
				PreferredName: 'fg',
				JoinDate: '2026-01-12T10:37:20.922Z',
				Status: 'Active',
				AnniversaryDate: '2027-02-01T00:00:00.000Z',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.agent).toEqual({
				id: '550e8400-e29b-41d4-a716-446655440000',
				agentId: '564',
				systemId: 3,
				isStaff: false,
				joinDate: new Date('2026-01-12T10:37:20.922Z'),
				lastName: 'Test',
				firstName: 'Auu',
				middleName: 'MM',
				preferredName: 'fg',
				anniversaryDate: new Date('2027-02-01T00:00:00.000Z'),
				lifecycleStatus: 'Active',
			});
		});

		it('should translate addresses with Personal AddressType', () => {
			const payload = {
				Addresss: [
					{
						Line1: '123 Main St',
						Line2: 'Apt 2',
						Town: 'Sydney',
						Postcode: '2000',
						Country: 'AU',
						AddressType: 'Personal',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses).toHaveLength(1);
			expect(result.addresses[0]).toEqual({
				city: 'Sydney',
				role: 'contact',
				type: 'personal',
				label: 'Personal Address',
				line1: '123 Main St',
				line2: 'Apt 2',
				isPrimary: false,
				countryAlpha2: 'AU',
				postalCode: '2000',
			});
		});

		it('should translate addresses with Business AddressType', () => {
			const payload = {
				Addresss: [
					{
						Line1: 'c',
						Line2: 'gh',
						Town: 'y',
						Postcode: '67',
						Country: 'AU',
						AddressType: 'Business',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses[0]).toEqual({
				city: 'y',
				role: 'contact',
				type: 'company',
				label: 'Business Address',
				line1: 'c',
				line2: 'gh',
				isPrimary: false,
				countryAlpha2: 'AU',
				postalCode: '67',
			});
		});

		it('should use UNKNOWN for city when Town is missing', () => {
			const payload = {
				Addresss: [
					{
						Line1: '123 Main St',
						Postcode: '2000',
						AddressType: 'Personal',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses[0].city).toBe('UNKNOWN');
		});

		it('should translate phones with Cell PhoneType', () => {
			const payload = {
				Phones: [
					{
						PhoneType: 'Cell',
						Number: '4123456789',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(1);
			expect(result.contactMethods[0]).toEqual({
				name: 'Mobile Phone',
				channel: 'phone',
				value: '4123456789',
				isPrimary: true,
				subType: 'mobile',
				smsOptIn: false,
			});
		});

		it('should translate phones with Whatsapp PhoneType', () => {
			const payload = {
				Phones: [
					{
						PhoneType: 'Whatsapp',
						Number: '9876543210',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods[0]).toEqual({
				name: 'Whats App',
				channel: 'phone',
				value: '9876543210',
				isPrimary: false,
				subType: 'mobile',
				smsOptIn: false,
			});
		});

		it('should translate Work Email and Personal Email', () => {
			const payload = {
				ExpEmail: 'auu.test@expaustralia.com.au',
				Email: 'auu@test.com',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(2);
			expect(result.contactMethods[0]).toEqual({
				name: 'Work Email',
				channel: 'email',
				value: 'auu.test@expaustralia.com.au',
				isPrimary: true,
				subType: 'work',
				smsOptIn: false,
			});
			expect(result.contactMethods[1]).toEqual({
				name: 'Personal Email',
				channel: 'email',
				value: 'auu@test.com',
				isPrimary: false,
				subType: 'personal',
				smsOptIn: false,
			});
		});

		it('should skip phones without Number', () => {
			const payload = {
				Phones: [
					{
						PhoneType: 'Whatsapp',
						// Missing Number
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(0);
		});

		it('should skip addresses missing Line1 or Postcode', () => {
			const payload = {
				Addresss: [
					{
						Town: 'Sydney',
						// Missing Line1 and Postcode
					},
					{
						Line1: '123 Main St',
						Town: 'Sydney',
						// Missing Postcode
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses).toHaveLength(0);
		});
	});
});

