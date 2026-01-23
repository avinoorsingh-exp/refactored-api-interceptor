import { Test, TestingModule } from '@nestjs/testing';
import { GlobalAdsAgentUpdatedConsumer } from './global-ads-agent-updated.consumer.js';
import { KafkaClientService } from '../kafka-client.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { KafkaMessageProcessingService } from '../kafka-message-processing.service.js';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';

describe('GlobalAdsAgentUpdatedConsumer', () => {
	let consumer: GlobalAdsAgentUpdatedConsumer;
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
				GlobalAdsAgentUpdatedConsumer,
				{ provide: KafkaClientService, useValue: mockKafkaClient },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
				{ provide: KafkaMessageProcessingService, useValue: mockKafkaMessageProcessingService },
			],
		}).compile();

		consumer = module.get<GlobalAdsAgentUpdatedConsumer>(GlobalAdsAgentUpdatedConsumer);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create consumer instance', () => {
			expect(consumer).toBeDefined();
		});

		it('should set logger context', () => {
			expect(mockLogger.setContext).toHaveBeenCalledWith('GlobalAdsAgentUpdatedConsumer');
		});
	});

	describe('translateKafkaMessageToUpsertData', () => {
		it('should translate basic agent fields', () => {
			const payload = {
				Uuid: '23406ed3-2828-11eb-9ae1-fd5b4d33ca4c',
				SourceSystemKey: 27,
				SourceSystemId: 13,
				FirstName: 'Shashank',
				LastName: 'Chauhan',
				MiddleName: '',
				PreferredName: 'Shashank',
				JoinDate: '2020-11-19T00:00:00.000Z',
				Status: 'Active',
				AnniversaryDate: '2026-12-01T00:00:00.000Z',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.agent).toEqual({
				id: '23406ed3-2828-11eb-9ae1-fd5b4d33ca4c',
				agentId: '27',
				systemId: 13,
				isStaff: false,
				joinDate: new Date('2020-11-19T00:00:00.000Z'),
				lastName: 'Chauhan',
				firstName: 'Shashank',
				middleName: undefined,
				preferredName: 'Shashank',
				anniversaryDate: new Date('2026-12-01T00:00:00.000Z'),
				lifecycleStatus: 'Active',
			});
		});

		it('should translate addresses using Addresses field', () => {
			const payload = {
				Addresses: [
					{
						Line1: 'Sd-135',
						Line2: 'Sector- 45',
						Postcode: '201301',
						AddressType: 'Business',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses).toHaveLength(1);
			expect(result.addresses[0].city).toBe('UNKNOWN');
			expect(result.addresses[0].type).toBe('company');
			expect(result.addresses[0].label).toBe('Business Address');
		});

		it('should translate phones with different PhoneTypes', () => {
			const payload = {
				Phones: [
					{
						PhoneType: 'Cell',
						Number: '(971) 100-6797',
					},
					{
						PhoneType: 'Home',
						Number: '(971) 200-6797',
					},
					{
						PhoneType: 'Office',
						Number: '(971) 300-6797',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(3);
			expect(result.contactMethods[0]).toEqual({
				name: 'Mobile Phone',
				channel: 'phone',
				value: '(971) 100-6797',
				isPrimary: true,
				subType: 'mobile',
				smsOptIn: false,
			});
			expect(result.contactMethods[1]).toEqual({
				name: 'Home Phone',
				channel: 'phone',
				value: '(971) 200-6797',
				isPrimary: false,
				subType: 'home',
				smsOptIn: false,
			});
			expect(result.contactMethods[2]).toEqual({
				name: 'Office Phone',
				channel: 'phone',
				value: '(971) 300-6797',
				isPrimary: false,
				subType: 'work',
				smsOptIn: false,
			});
		});

		it('should translate Work Email and Personal Email', () => {
			const payload = {
				ExpEmail: 'shashank.chauhan@expglobalindia.com',
				Email: 'chauhan.ansh1@gmail.com',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(2);
			expect(result.contactMethods[0]).toEqual({
				name: 'Work Email',
				channel: 'email',
				value: 'shashank.chauhan@expglobalindia.com',
				isPrimary: true,
				subType: 'work',
				smsOptIn: false,
			});
			expect(result.contactMethods[1]).toEqual({
				name: 'Personal Email',
				channel: 'email',
				value: 'chauhan.ansh1@gmail.com',
				isPrimary: false,
				subType: 'personal',
				smsOptIn: false,
			});
		});
	});
});

