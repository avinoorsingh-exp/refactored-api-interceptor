import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SponsorChangedService } from './sponsor-changed.service.js';
import type { IAgentRepository } from '../agents/ports/agent.repository.port.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { LoggerService } from '../../core/logger.service.js';
import type { Agent } from '@exprealty/shared-domain';

describe('SponsorChangedService', () => {
	let service: SponsorChangedService;
	let mockAgentRepository: jest.Mocked<IAgentRepository>;
	let mockKafkaProducer: jest.Mocked<KafkaProducerService>;
	let mockLogger: jest.Mocked<LoggerService>;

	const mockAgent: Agent & {
		contactMethod?: Array<{
			channel: string;
			value: string;
			isPrimary: boolean;
			subType?: string;
		}>;
		address?: Array<{
			line1: string;
			line2?: string;
			city: string;
			state?: {
				code?: string;
			};
		}>;
	} = {
		id: '2b43a5dc-21c5-4925-97bc-53ea4ab0ed04',
		agentId: '12345',
		firstName: 'John',
		lastName: 'Doe',
		contactMethod: [
			{
				channel: 'email',
				value: 'john.doe@example.com',
				isPrimary: true,
				subType: 'work',
			},
			{
				channel: 'email',
				value: 'john.doe.personal@example.com',
				isPrimary: false,
				subType: 'personal',
			},
			{
				channel: 'phone',
				value: '+1-555-123-4567',
				isPrimary: true,
				subType: 'mobile',
			},
			{
				channel: 'phone',
				value: '+1-555-987-6543',
				isPrimary: false,
				subType: 'work',
			},
		],
		address: [
			{
				line1: '123 Main Street',
				line2: 'Suite 100',
				city: 'Springfield',
				state: {
					code: 'IL',
				},
			},
			{
				line1: '456 Business Park',
				city: 'Chicago',
				state: {
					code: 'IL',
				},
			},
		],
	} as any;

	beforeEach(async () => {
		mockAgentRepository = {
			findPage: jest.fn(),
		} as any;

		mockKafkaProducer = {
			sendSponsorChangedMessage: jest.fn().mockResolvedValue(undefined),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SponsorChangedService,
				{ provide: 'IAgentRepository', useValue: mockAgentRepository },
				{ provide: KafkaProducerService, useValue: mockKafkaProducer },
				{ provide: LoggerService, useValue: mockLogger },
			],
		}).compile();

		service = module.get<SponsorChangedService>(SponsorChangedService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('processSponsorChanged', () => {
		const applicantUuid = '550e8400-e29b-41d4-a716-446655440000';
		const sponsorUuid = '2b43a5dc-21c5-4925-97bc-53ea4ab0ed04';

		it('should process sponsor changed event successfully', async () => {
			mockAgentRepository.findPage.mockResolvedValue({
				items: [mockAgent],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockAgentRepository.findPage).toHaveBeenCalledWith(
				{
					filter: {
						conditions: [{ field: 'id', operator: 'eq', value: sponsorUuid }],
						logicalOperator: 'AND',
					},
					limit: 1,
					offset: 0,
				},
				{
					include: ['contactMethod', 'address'],
				},
			);

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					ApplicantUuid: applicantUuid,
					Sponsor: expect.objectContaining({
						Uuid: sponsorUuid,
						AgentUuid: sponsorUuid,
						AgentID: '12345',
						FirstName: 'John',
						LastName: 'Doe',
						Email: 'john.doe.personal@example.com',
						ExpEmail: 'john.doe@example.com',
						TypeOfActor: 'Agent',
					}),
				}),
				applicantUuid,
			);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.stringContaining('Sponsor changed message sent successfully'),
			);
		});

		it('should throw NotFoundException when sponsor agent is not found', async () => {
			mockAgentRepository.findPage.mockResolvedValue({
				items: [],
				total: 0,
				limit: 1,
				offset: 0,
			});

			await expect(
				service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant'),
			).rejects.toThrow(NotFoundException);

			expect(mockKafkaProducer.sendSponsorChangedMessage).not.toHaveBeenCalled();
		});

		it('should build payload with empty phone list when no phone contact methods', async () => {
			const agentWithoutPhones = {
				...mockAgent,
				contactMethod: mockAgent.contactMethod?.filter((cm) => cm.channel !== 'phone'),
			};

			mockAgentRepository.findPage.mockResolvedValue({
				items: [agentWithoutPhones],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					Sponsor: expect.objectContaining({
						PhoneList: [],
					}),
				}),
				expect.any(String),
			);
		});

		it('should build payload with empty address list when no addresses', async () => {
			const agentWithoutAddresses = {
				...mockAgent,
				address: [],
			};

			mockAgentRepository.findPage.mockResolvedValue({
				items: [agentWithoutAddresses],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					Sponsor: expect.objectContaining({
						AddressList: [],
					}),
				}),
				expect.any(String),
			);
		});

		it('should use empty string for Email when no secondary email found', async () => {
			const agentWithoutSecondaryEmail = {
				...mockAgent,
				contactMethod: mockAgent.contactMethod?.filter(
					(cm) => !(cm.channel === 'email' && !cm.isPrimary),
				),
			};

			mockAgentRepository.findPage.mockResolvedValue({
				items: [agentWithoutSecondaryEmail],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					Sponsor: expect.objectContaining({
						Email: '',
					}),
				}),
				expect.any(String),
			);
		});

		it('should use empty string for ExpEmail when no primary email found', async () => {
			const agentWithoutPrimaryEmail = {
				...mockAgent,
				contactMethod: mockAgent.contactMethod?.filter(
					(cm) => !(cm.channel === 'email' && cm.isPrimary),
				),
			};

			mockAgentRepository.findPage.mockResolvedValue({
				items: [agentWithoutPrimaryEmail],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					Sponsor: expect.objectContaining({
						ExpEmail: '',
					}),
				}),
				expect.any(String),
			);
		});

		it('should use default PhoneType "Cell" when subType is missing', async () => {
			const agentWithPhoneWithoutSubType = {
				...mockAgent,
				contactMethod: [
					{
						channel: 'phone',
						value: '+1-555-999-8888',
						isPrimary: true,
					},
				],
			};

			mockAgentRepository.findPage.mockResolvedValue({
				items: [agentWithPhoneWithoutSubType],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					Sponsor: expect.objectContaining({
						PhoneList: [
							{
								PhoneType: 'Cell',
								Number: '+1-555-999-8888',
							},
						],
					}),
				}),
				expect.any(String),
			);
		});

		it('should map subType to PhoneType: mobile→Cell, home→Home, work/fax→Office', async () => {
			const agentWithAllPhoneTypes = {
				...mockAgent,
				contactMethod: [
					{ channel: 'phone', value: '+1-555-111', isPrimary: true, subType: 'mobile' },
					{ channel: 'phone', value: '+1-555-222', isPrimary: false, subType: 'home' },
					{ channel: 'phone', value: '+1-555-333', isPrimary: false, subType: 'work' },
					{ channel: 'phone', value: '+1-555-444', isPrimary: false, subType: 'fax' },
				],
			};

			mockAgentRepository.findPage.mockResolvedValue({
				items: [agentWithAllPhoneTypes],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					Sponsor: expect.objectContaining({
						PhoneList: [
							{ PhoneType: 'Cell', Number: '+1-555-111' },
							{ PhoneType: 'Home', Number: '+1-555-222' },
							{ PhoneType: 'Office', Number: '+1-555-333' },
							{ PhoneType: 'Office', Number: '+1-555-444' },
						],
					}),
				}),
				expect.any(String),
			);
		});

		it('should handle address without line2 and state', async () => {
			const agentWithMinimalAddress = {
				...mockAgent,
				address: [
					{
						line1: '789 Simple Street',
						city: 'Plainville',
					},
				],
			};

			mockAgentRepository.findPage.mockResolvedValue({
				items: [agentWithMinimalAddress],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					Sponsor: expect.objectContaining({
						AddressList: [
							{
								Line1: '789 Simple Street',
								Line2: undefined,
								Town: 'Plainville',
								State: undefined,
							},
						],
					}),
				}),
				expect.any(String),
			);
		});

		it('should log error and rethrow when repository throws error', async () => {
			const repositoryError = new Error('Database connection failed');
			mockAgentRepository.findPage.mockRejectedValue(repositoryError);

			await expect(
				service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant'),
			).rejects.toThrow(repositoryError);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to process sponsor changed event'),
				expect.objectContaining({
					subjectUuid: applicantUuid,
					sponsorUuid,
				}),
			);
		});

		it('should log error and rethrow when kafka producer throws error', async () => {
			mockAgentRepository.findPage.mockResolvedValue({
				items: [mockAgent],
				total: 1,
				limit: 1,
				offset: 0,
			});

			const kafkaError = new Error('Kafka send failed');
			mockKafkaProducer.sendSponsorChangedMessage.mockRejectedValue(kafkaError);

			await expect(
				service.processSponsorChanged(applicantUuid, sponsorUuid, 'applicant'),
			).rejects.toThrow(kafkaError);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to process sponsor changed event'),
				expect.objectContaining({
					subjectUuid: applicantUuid,
					sponsorUuid,
				}),
			);
		});

		it('should use AgentUuid in payload when type is agent', async () => {
			mockAgentRepository.findPage.mockResolvedValue({
				items: [mockAgent],
				total: 1,
				limit: 1,
				offset: 0,
			});

			await service.processSponsorChanged(applicantUuid, sponsorUuid, 'agent');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					AgentUuid: applicantUuid,
					Sponsor: expect.objectContaining({
						Uuid: sponsorUuid,
						AgentUuid: sponsorUuid,
					}),
				}),
				applicantUuid,
			);
		});
	});

	describe('processSponsorWriteIn', () => {
		const applicantUuid = '550e8400-e29b-41d4-a716-446655440000';
		const sponsorName = 'John Doe';

		it('should process sponsor write-in event successfully', async () => {
			await service.processSponsorWriteIn(applicantUuid, sponsorName, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				{
					ApplicantUuid: applicantUuid,
					SponsorWriteIn: {
						Name: sponsorName,
					},
				},
				applicantUuid,
			);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.stringContaining('Sponsor write-in message sent successfully'),
			);
		});

		it('should handle sponsor name with spaces', async () => {
			const sponsorNameWithSpaces = 'John Michael Doe';
			await service.processSponsorWriteIn(applicantUuid, sponsorNameWithSpaces, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				{
					ApplicantUuid: applicantUuid,
					SponsorWriteIn: {
						Name: sponsorNameWithSpaces,
					},
				},
				applicantUuid,
			);
		});

		it('should handle empty sponsor name', async () => {
			const emptyName = '';
			await service.processSponsorWriteIn(applicantUuid, emptyName, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				{
					ApplicantUuid: applicantUuid,
					SponsorWriteIn: {
						Name: emptyName,
					},
				},
				applicantUuid,
			);
		});

		it('should handle sponsor name with special characters', async () => {
			const sponsorNameWithSpecialChars = "John O'Brien-Smith";
			await service.processSponsorWriteIn(applicantUuid, sponsorNameWithSpecialChars, 'applicant');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				{
					ApplicantUuid: applicantUuid,
					SponsorWriteIn: {
						Name: sponsorNameWithSpecialChars,
					},
				},
				applicantUuid,
			);
		});

		it('should log error and rethrow when kafka producer throws error', async () => {
			const kafkaError = new Error('Kafka send failed');
			mockKafkaProducer.sendSponsorChangedMessage.mockRejectedValue(kafkaError);

			await expect(
				service.processSponsorWriteIn(applicantUuid, sponsorName, 'applicant'),
			).rejects.toThrow(kafkaError);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to process sponsor write-in event'),
				expect.objectContaining({
					subjectUuid: applicantUuid,
					sponsorName,
				}),
			);
		});

		it('should log message payload before sending', async () => {
			await service.processSponsorWriteIn(applicantUuid, sponsorName, 'applicant');

			expect(mockLogger.info).toHaveBeenCalledWith(
				'Sponsor write-in message payload - ready to send',
				expect.objectContaining({
					subjectUuid: applicantUuid,
					sponsorName,
					type: 'applicant',
					message: {
						ApplicantUuid: applicantUuid,
						SponsorWriteIn: {
							Name: sponsorName,
						},
					},
				}),
			);
		});

		it('should use AgentUuid in payload when type is agent', async () => {
			await service.processSponsorWriteIn(applicantUuid, sponsorName, 'agent');

			expect(mockKafkaProducer.sendSponsorChangedMessage).toHaveBeenCalledWith(
				{
					AgentUuid: applicantUuid,
					SponsorWriteIn: {
						Name: sponsorName,
					},
				},
				applicantUuid,
			);
		});
	});
});



