import { Test, TestingModule } from '@nestjs/testing';
import { UkAgentDetailsAgentUpdatedConsumer } from './uk-agent-details-agent-updated.consumer.js';
import { KafkaClientService } from '../kafka-client.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { KafkaMessageProcessingService } from '../kafka-message-processing.service.js';
import { UkAgentUpsertService } from '../services/uk-agent-upsert.service.js';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';

describe('UkAgentDetailsAgentUpdatedConsumer', () => {
	let consumer: UkAgentDetailsAgentUpdatedConsumer;
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

		const mockUkAgentUpsertService = {
			upsertAgentWithAssociations: jest.fn().mockResolvedValue(undefined),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UkAgentDetailsAgentUpdatedConsumer,
				{ provide: KafkaClientService, useValue: mockKafkaClient },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
				{ provide: KafkaMessageProcessingService, useValue: mockKafkaMessageProcessingService },
				{ provide: UkAgentUpsertService, useValue: mockUkAgentUpsertService },
			],
		}).compile();

		consumer = module.get<UkAgentDetailsAgentUpdatedConsumer>(UkAgentDetailsAgentUpdatedConsumer);
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
				topic: 'UK_AgentDetails_AgentUpdated_V2',
				partition: 0,
				message: { value: Buffer.from(JSON.stringify({ Uuid: 'e6640aa7-f06a-11f0-8c8b-0f306746e3cd', FirstName: 'A', LastName: 'B' })), offset: '0', key: null, headers: {}, timestamp: '' },
			} as any);
			expect(mockLogger.setContext).toHaveBeenCalledWith('UkAgentDetailsAgentUpdatedConsumer');
		});
	});

	describe('translateKafkaMessageToUpsertData', () => {
		it('should translate basic agent fields', () => {
			const payload = {
				Uuid: '84c3944f-efe3-11f0-8c8b-eb1b67ae1158',
				SourceSystemKey: 1549,
				SourceSystemId: 2,
				FirstName: 'Tanny',
				LastName: 'Wills',
				MiddleName: 'Chris',
				PreferredName: 'Tanny Wills',
				JoinDate: '2026-01-12T18:19:54.452Z',
				Status: 'Active',
				AnniversaryDate: '2027-02-01T00:00:00.000Z',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.agent).toEqual({
				id: '84c3944f-efe3-11f0-8c8b-eb1b67ae1158',
				agentId: '1549',
				systemId: 2,
				isStaff: false,
				joinDate: new Date('2026-01-12T18:19:54.452Z'),
				lastName: 'Wills',
				firstName: 'Tanny',
				middleName: 'Chris',
				preferredName: 'Tanny Wills',
				anniversaryDate: new Date('2027-02-01T00:00:00.000Z'),
				lifecycleStatus: 'Active',
			});
		});

		it('should translate addresses with Business AddressType', () => {
			const payload = {
				Addresss: [
					{
						Line1: 'ss',
						Line2: 'ss',
						Town: 'ss',
						Postcode: '7845',
						Country: 'GB',
						AddressType: 'Business',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses[0]).toEqual({
				city: 'ss',
				role: 'contact',
				type: 'company',
				label: 'Business Address',
				line1: 'ss',
				line2: 'ss',
				isPrimary: false,
				countryAlpha2: 'GB',
				postalCode: '7845',
			});
		});

		it('should use UNKNOWN for city when Town is missing', () => {
			const payload = {
				Addresss: [
					{
						Line1: '123 Main St',
						Postcode: 'SW1A 1AA',
						AddressType: 'Personal',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses[0].city).toBe('UNKNOWN');
		});

		it('should translate multiple phones', () => {
			const payload = {
				Phones: [
					{
						PhoneType: 'Cell',
						Number: '98741253395',
					},
					{
						PhoneType: 'Whatsapp',
						Number: '87412369854',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(2);
			expect(result.contactMethods[0]).toEqual({
				name: 'Mobile Phone',
				channel: 'phone',
				value: '98741253395',
				isPrimary: true,
				subType: 'mobile',
				smsOptIn: false,
			});
			expect(result.contactMethods[1]).toEqual({
				name: 'Whats App',
				channel: 'phone',
				value: '87412369854',
				isPrimary: false,
				subType: 'mobile',
				smsOptIn: false,
			});
		});

		it('should translate Work Email and Personal Email', () => {
			const payload = {
				ExpEmail: 'tanny.wills@exp.uk.com',
				Email: 'tanny.wills@yopmail.com',
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(2);
			expect(result.contactMethods[0].isPrimary).toBe(true);
			expect(result.contactMethods[1].isPrimary).toBe(false);
		});
	});
});

