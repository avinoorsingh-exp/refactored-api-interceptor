import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { EnterpriseAgentUpdatedConsumer } from './enterprise-agent-updated.consumer.js';
import { KafkaClientService } from '../kafka-client.service.js';
import { ConfigService } from '../../../core/config.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { KafkaMessageProcessingService } from '../kafka-message-processing.service.js';
import { EnterpriseAgentUpsertService } from '../services/enterprise-agent-upsert.service.js';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';

describe('EnterpriseAgentUpdatedConsumer', () => {
	let consumer: EnterpriseAgentUpdatedConsumer;
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
			on: jest.fn(),
			events: { GROUP_JOIN: 'group.join', CRASH: 'crash' },
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

		const mockEnterpriseAgentUpsertService = {
			upsertAgentWithAssociations: jest.fn().mockResolvedValue(undefined),
		} as any;

		const mockModuleRef = {
			get: jest.fn().mockImplementation((token: any) => {
				if (token === KafkaMessageProcessingService) {
					return mockKafkaMessageProcessingService;
				}
				return undefined;
			}),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EnterpriseAgentUpdatedConsumer,
				{ provide: KafkaClientService, useValue: mockKafkaClient },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: LoggerService, useValue: mockLogger },
				{ provide: KafkaMessageProcessingService, useValue: mockKafkaMessageProcessingService },
				{ provide: EnterpriseAgentUpsertService, useValue: mockEnterpriseAgentUpsertService },
				{ provide: ModuleRef, useValue: mockModuleRef },
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

	describe('getMessageProcessingService', () => {
		it('should resolve via ModuleRef when constructor injection is null (fallback for circular dependency)', async () => {
			const mockModuleRefResolve = {
				get: jest.fn().mockImplementation((token: any) => {
					if (token === KafkaMessageProcessingService) {
						return mockKafkaMessageProcessingService;
					}
					return undefined;
				}),
			} as any;
			const moduleWithNullService = await Test.createTestingModule({
				providers: [
					EnterpriseAgentUpdatedConsumer,
					{ provide: KafkaClientService, useValue: mockKafkaClient },
					{ provide: ConfigService, useValue: mockConfigService },
					{ provide: LoggerService, useValue: mockLogger },
					{ provide: KafkaMessageProcessingService, useValue: null },
					{ provide: EnterpriseAgentUpsertService, useValue: { upsertAgentWithAssociations: jest.fn() } },
					{ provide: ModuleRef, useValue: mockModuleRefResolve },
				],
			}).compile();
			const consumerWithNullInjection = moduleWithNullService.get<EnterpriseAgentUpdatedConsumer>(EnterpriseAgentUpdatedConsumer);
			const resolved = (consumerWithNullInjection as any).getMessageProcessingService();
			expect(resolved).toBe(mockKafkaMessageProcessingService);
			expect(mockModuleRefResolve.get).toHaveBeenCalledWith(KafkaMessageProcessingService, { strict: false });
		});
	});


	describe('message handling', () => {
		let messageHandler: (params: { topic: string; partition: number; message: KafkaMessage }) => Promise<void>;

		beforeEach(async () => {
			mockConfigService.get.mockReturnValue('dev');
			await (consumer as any).start();
			// Consumer does not call run() in start(); runtime manager does. Use getMessageHandler() for tests.
			messageHandler = consumer.getMessageHandler();
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

			expect(processSpy).toHaveBeenCalledWith({ agentId: '123', name: 'Test' }, false);
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
				'Message processing failed',
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


	describe('translateKafkaMessageToUpsertData', () => {
		it('should translate basic agent fields', () => {
			const payload = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				systemkey: 12345,
				source_system_member_key: '67890',
				member_first_name: 'John',
				member_last_name: 'Doe',
				member_middle_name: 'Middle',
				suffix: 'Jr',
				preferred_name: 'Johnny',
				title: 'Mr',
				Birthday: '1990-01-01',
				lifecycle_status_caption: 'Active',
				join_date: '2020-01-01',
				anniversary_date: '2021-01-01',
				termination_date: null,
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.agent).toEqual({
				id: '550e8400-e29b-41d4-a716-446655440000',
				agentId: '67890', // source_system_member_key maps to agentId
				systemId: 12345, // systemkey maps to systemId
				firstName: 'John',
				lastName: 'Doe',
				middleName: 'Middle',
				suffix: 'Jr',
				preferredName: 'Johnny',
				title: 'Mr',
				birthDate: new Date('1990-01-01'),
				lifecycleStatus: 'Active',
				joinDate: new Date('2020-01-01'),
				anniversaryDate: new Date('2021-01-01'),
				terminationDate: undefined,
				isStaff: false,
			});
		});

		it('should validate suffix against enum and exclude invalid values', () => {
			// Test with valid suffix (should be included)
			const payloadWithValidSuffix = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				member_first_name: 'John',
				member_last_name: 'Doe',
				suffix: '  Jr  ',
				lifecycle_status_caption: 'Active',
			};
			const resultWithValidSuffix = (consumer as any).translateKafkaMessageToUpsertData(payloadWithValidSuffix);
			expect(resultWithValidSuffix.agent.suffix).toBe('Jr');

			// Test with other valid suffixes
			const validSuffixes = ['Sr', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'Esq'];
			validSuffixes.forEach((suffix) => {
				const payload = {
					uuid: '550e8400-e29b-41d4-a716-446655440000',
					member_first_name: 'John',
					member_last_name: 'Doe',
					suffix,
					lifecycle_status_caption: 'Active',
				};
				const result = (consumer as any).translateKafkaMessageToUpsertData(payload);
				expect(result.agent.suffix).toBe(suffix);
			});

			// Test with null suffix (should be excluded)
			const payloadWithNullSuffix = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				member_first_name: 'John',
				member_last_name: 'Doe',
				suffix: null,
				lifecycle_status_caption: 'Active',
			};
			const resultWithNullSuffix = (consumer as any).translateKafkaMessageToUpsertData(payloadWithNullSuffix);
			expect(resultWithNullSuffix.agent.suffix).toBeUndefined();

			// Test with empty string suffix (should be excluded)
			const payloadWithEmptySuffix = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				member_first_name: 'John',
				member_last_name: 'Doe',
				suffix: '',
				lifecycle_status_caption: 'Active',
			};
			const resultWithEmptySuffix = (consumer as any).translateKafkaMessageToUpsertData(payloadWithEmptySuffix);
			expect(resultWithEmptySuffix.agent.suffix).toBeUndefined();

			// Test with whitespace-only suffix (should be excluded)
			const payloadWithWhitespaceSuffix = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				member_first_name: 'John',
				member_last_name: 'Doe',
				suffix: '   ',
				lifecycle_status_caption: 'Active',
			};
			const resultWithWhitespaceSuffix = (consumer as any).translateKafkaMessageToUpsertData(payloadWithWhitespaceSuffix);
			expect(resultWithWhitespaceSuffix.agent.suffix).toBeUndefined();

			// Test with undefined suffix (should be excluded)
			const payloadWithUndefinedSuffix = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				member_first_name: 'John',
				member_last_name: 'Doe',
				lifecycle_status_caption: 'Active',
			};
			const resultWithUndefinedSuffix = (consumer as any).translateKafkaMessageToUpsertData(payloadWithUndefinedSuffix);
			expect(resultWithUndefinedSuffix.agent.suffix).toBeUndefined();

			// Test with invalid suffix value (not in enum) - should be excluded
			const payloadWithInvalidSuffix = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				member_first_name: 'John',
				member_last_name: 'Doe',
				suffix: 'InvalidSuffix',
				lifecycle_status_caption: 'Active',
			};
			const resultWithInvalidSuffix = (consumer as any).translateKafkaMessageToUpsertData(payloadWithInvalidSuffix);
			expect(resultWithInvalidSuffix.agent.suffix).toBeUndefined();

			// Test with lowercase valid suffix (should be excluded - enum is case-sensitive)
			const payloadWithLowercaseSuffix = {
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				member_first_name: 'John',
				member_last_name: 'Doe',
				suffix: 'jr',
				lifecycle_status_caption: 'Active',
			};
			const resultWithLowercaseSuffix = (consumer as any).translateKafkaMessageToUpsertData(payloadWithLowercaseSuffix);
			expect(resultWithLowercaseSuffix.agent.suffix).toBeUndefined();
		});

		it('should translate contact methods from member_email, secondary_email, and cell_phone', () => {
			const payload = {
				member_email: 'primary@example.com',
				secondary_email: 'secondary@example.com',
				cell_phone: '+1-555-123-4567',
				ReceiveText: true,
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(3);
			expect(result.contactMethods[0]).toEqual({
				name: 'Primary Email',
				channel: 'email',
				value: 'primary@example.com',
				isPrimary: true,
				subType: 'work',
				smsOptIn: false,
			});
			expect(result.contactMethods[1]).toEqual({
				name: 'Secondary Email',
				channel: 'email',
				value: 'secondary@example.com',
				isPrimary: false,
				subType: 'personal',
				smsOptIn: false,
			});
			expect(result.contactMethods[2]).toEqual({
				name: 'Mobile Phone',
				channel: 'phone',
				value: '+1-555-123-4567',
				isPrimary: true,
				subType: 'mobile',
				smsOptIn: true,
			});
		});

		it('should use member_mobile_phone if cell_phone is not present', () => {
			const payload = {
				member_mobile_phone: '+1-555-999-8888',
				ReceiveText: false,
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toHaveLength(1);
			expect(result.contactMethods[0].value).toBe('+1-555-999-8888');
		});

		it('should translate addresses with all fields', () => {
			const payload = {
				addresses: [
					{
						address_line_1: '123 Main St',
						address_line_2: 'Suite 100',
						city: 'Springfield',
						postal_code: '62701',
						unit_number: 'A',
						county: 'Sangamon',
						label: 'Home',
						address_type_key: 'Contactinfo',
						state: {
							code: 'IL',
						},
						country: {
							iso_3166_1: {
								alpha_2: 'US',
							},
						},
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses).toHaveLength(1);
			expect(result.addresses[0]).toEqual({
				line1: '123 Main St',
				line2: 'Suite 100',
				city: 'Springfield',
				postalCode: '62701',
				unit: 'A',
				county: 'Sangamon',
				label: 'Home',
				type: 'personal',
				role: 'contact',
				isPrimary: true,
				stateCode: 'IL',
				countryAlpha2: 'US',
			});
		});

		it('should support alternative address field names (line_1, zip)', () => {
			const payload = {
				addresses: [
					{
						line_1: '456 Oak Ave',
						line_2: 'Apt 2B',
						city: 'Chicago',
						zip: '60601',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses).toHaveLength(1);
			expect(result.addresses[0].line1).toBe('456 Oak Ave');
			expect(result.addresses[0].line2).toBe('Apt 2B');
			expect(result.addresses[0].postalCode).toBe('60601');
		});

		it('should skip addresses missing required fields', () => {
			const payload = {
				addresses: [
					{
						city: 'Springfield',
						// Missing line1 and postalCode
					},
					{
						address_line_1: '123 Main St',
						city: 'Chicago',
						postal_code: '60601',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.addresses).toHaveLength(1);
			expect(result.addresses[0].line1).toBe('123 Main St');
		});

		it('should translate offices', () => {
			const payload = {
				offices: [
					{
						office_name: 'Downtown Office',
						originating_system_office_key: '999',
						is_primary: true,
						company: {
							intacct_entity_no: '123',
						},
						lifecycle_status: 'active',
						phone: '+1-555-111-2222',
						website: 'https://office.example.com',
						state: 'IL',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.offices).toHaveLength(1);
			expect(result.offices[0]).toEqual({
				officeId: '999',
				officeName: 'Downtown Office',
				isPrimary: true,
				companyId: '123',
				lifecycleStatus: 'active',
				phone: '+1-555-111-2222',
				website: 'https://office.example.com',
				primaryState: 'IL',
			});
		});

		it('should support alternative office field name (name)', () => {
			const payload = {
				offices: [
					{
						name: 'Branch Office',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.offices).toHaveLength(1);
			expect(result.offices[0].officeName).toBe('Branch Office');
		});

		it('should skip offices without name', () => {
			const payload = {
				offices: [
					{
						phone: '+1-555-111-2222',
						// Missing name
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.offices).toHaveLength(0);
		});

		it('should translate MLS from mlss array', () => {
			const payload = {
				mlss: [
					{
						mlsid: '100',
						name: 'Metro MLS',
						ouid: 'mls-123',
						global_id: 200,
						shortname: 'MMLS',
						org_type: 'MLS',
						lifecycle_status: 'active',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.mls).toHaveLength(1);
			expect(result.mls[0]).toEqual({
				mlsId: '100',
				name: 'Metro MLS',
				ouid: 'mls-123',
				globalId: 200,
				shortName: 'MMLS',
				orgType: 'mls',
				lifecycleStatus: 'active',
			});
		});

		it('should normalize org_type to lowercase', () => {
			const payload = {
				mlss: [
					{
						name: 'Test MLS',
						org_type: 'MLS',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.mls[0].orgType).toBe('mls');
		});

		it('should use org_status as fallback for lifecycle_status', () => {
			const payload = {
				mlss: [
					{
						name: 'Test MLS',
						org_status: 'inactive',
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.mls[0].lifecycleStatus).toBe('inactive');
		});

		it('should skip MLS entries without name', () => {
			const payload = {
				mlss: [
					{
						mlsid: '100',
						// Missing name
					},
				],
			};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.mls).toHaveLength(0);
		});

		it('should return empty arrays when no data present', () => {
			const payload = {};

			const result = (consumer as any).translateKafkaMessageToUpsertData(payload);

			expect(result.contactMethods).toEqual([]);
			expect(result.addresses).toEqual([]);
			expect(result.offices).toEqual([]);
			expect(result.mls).toEqual([]);
		});
	});

	describe('mapLifecycleStatus', () => {
		it('should map known statuses correctly', () => {
			const mapStatus = (consumer as any).mapLifecycleStatus.bind(consumer);

			expect(mapStatus('Joining')).toBe('Joining');
			expect(mapStatus('Active')).toBe('Active');
			expect(mapStatus('Inactive')).toBe('Inactive');
			expect(mapStatus('InActive')).toBe('Inactive');
			expect(mapStatus('Vested')).toBe('Vested');
			expect(mapStatus('Vested Retired')).toBe('VestedRetired');
			expect(mapStatus('VestedRetired')).toBe('VestedRetired');
			expect(mapStatus('Lead Only')).toBe('LeadOnly');
			expect(mapStatus('LeadOnly')).toBe('LeadOnly');
		});

		it('should default to Joining for unknown statuses', () => {
			const mapStatus = (consumer as any).mapLifecycleStatus.bind(consumer);

			expect(mapStatus('UnknownStatus')).toBe('Joining');
			expect(mapStatus('')).toBe('Joining');
		});
	});
});


