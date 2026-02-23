import { Test, TestingModule } from '@nestjs/testing';
import { GlobalAdsAgentCreatedConsumer } from './global-ads-agent-created.consumer.js';
import { KafkaClientService } from '../kafka-client.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { KafkaMessageProcessingService } from '../kafka-message-processing.service.js';
import { GadsAgentUpsertService } from '../services/gads-agent-upsert.service.js';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';

describe('GlobalAdsAgentCreatedConsumer', () => {
	let consumer: GlobalAdsAgentCreatedConsumer;
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

		const mockGadsAgentUpsertService = {
			upsertAgentWithAssociations: jest.fn().mockResolvedValue(undefined),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GlobalAdsAgentCreatedConsumer,
				{ provide: KafkaClientService, useValue: mockKafkaClient },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
				{ provide: KafkaMessageProcessingService, useValue: mockKafkaMessageProcessingService },
				{ provide: GadsAgentUpsertService, useValue: mockGadsAgentUpsertService },
			],
		}).compile();

		consumer = module.get<GlobalAdsAgentCreatedConsumer>(GlobalAdsAgentCreatedConsumer);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create consumer instance', () => {
			expect(consumer).toBeDefined();
		});

		it('should set logger context', async () => {
			const handler = consumer.getMessageHandler();
			await handler({
				topic: 'Global_ADS_AgentCreated_V2',
				partition: 0,
				message: { value: Buffer.from(JSON.stringify({ Uuid: 'e6640aa7-f06a-11f0-8c8b-0f306746e3cd', FirstName: 'A', LastName: 'B' })), offset: '0', key: null, headers: {}, timestamp: '' },
			} as any);
			expect(mockLogger.setContext).toHaveBeenCalledWith('GlobalAdsAgentCreatedConsumer');
		});
	});

	describe('translateKafkaMessageToUpsertData', () => {
		it('should translate basic agent fields', () => {
			const payload = {
				Uuid: 'c6640aa7-f06a-11f0-8c8b-0f306746e3cd',
				SourceSystemKey: 16510,
				SourceSystemId: 2,
				FirstName: 'Rahul',
				LastName: 'Reddy',
				MiddleName: 'yt',
				PreferredName: 'd',
				JoinDate: '2026-01-13T00:00:00.000Z',
				Status: 'Active',
				AnniversaryDate: '2027-02-01T00:00:00.000Z',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.agent).toEqual({
				id: 'c6640aa7-f06a-11f0-8c8b-0f306746e3cd',
				agentId: '16510',
				systemId: 2,
				isStaff: false,
				joinDate: new Date('2026-01-13T00:00:00.000Z'),
				lastName: 'Reddy',
				firstName: 'Rahul',
				middleName: 'yt',
				preferredName: 'd',
				anniversaryDate: new Date('2027-02-01T00:00:00.000Z'),
				lifecycleStatus: 'Active',
			});
		});

		it('should translate addresses using Addresses field (not Addresss)', () => {
			const payload = {
				Addresses: [
					{
						Line1: 'd',
						Line2: 'gh',
						Town: 'y',
						Postcode: '67',
						Country: 'GB',
						AddressType: 'Business',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses).toHaveLength(1);
			expect(result.addresses[0]).toEqual({
				city: 'y',
				role: 'contact',
				type: 'company',
				label: 'Business Address',
				line1: 'd',
				line2: 'gh',
				isPrimary: false,
				countryAlpha2: 'GB',
				postalCode: '67',
			});
		});

		it('should use UNKNOWN for city when Town is missing', () => {
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

			expect(result.addresses[0].city).toBe('UNKNOWN');
		});

		it('should translate phones and emails', () => {
			const payload = {
				Phones: [
					{
						PhoneType: 'Cell',
						Number: '7123456779',
					},
					{
						PhoneType: 'Whatsapp',
						Number: '4321234567',
					},
				],
				ExpEmail: 'rahul.reddy@exp.uk.com',
				Email: 'rahulr@test.com',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(4);
			expect(result.contactMethods[0].name).toBe('Mobile Phone');
			expect(result.contactMethods[1].name).toBe('Whats App');
			expect(result.contactMethods[2].name).toBe('Work Email');
			expect(result.contactMethods[3].name).toBe('Personal Email');
		});
	});
});

