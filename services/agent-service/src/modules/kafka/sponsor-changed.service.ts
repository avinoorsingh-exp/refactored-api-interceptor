import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { IAgentRepository } from '../agents/ports/agent.repository.port.js';
import type { Agent } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';
import { KafkaProducerService } from './kafka-producer.service.js';

/**
 * Interface for the sponsor changed Kafka message payload.
 */
interface SponsorChangedMessage {
	ApplicantUuid: string;
	Sponsor: {
		Uuid: string;
		AgentUuid: string;
		AgentID: string;
		FirstName: string;
		LastName: string;
		Email: string;
		ExpEmail: string;
		Description: string;
		TypeOfActor: 'Agent';
		PhoneList: Array<{
			PhoneType: string;
			Number: string;
		}>;
		AddressList: Array<{
			Line1: string;
			Line2?: string;
			Town: string;
			State?: string;
		}>;
	};
}

/**
 * Interface for the sponsor write-in Kafka message payload.
 */
interface SponsorWriteInMessage {
	ApplicantUuid: string;
	SponsorWriteIn: {
		Name: string;
	};
}

/**
 * Service for handling sponsor changed events.
 * Builds and sends Kafka messages to Global_SMS_SponsorChanged_V2 topic.
 */
@Injectable()
export class SponsorChangedService {
	constructor(
		@Inject('IAgentRepository')
		private readonly agentRepository: IAgentRepository,
		private readonly kafkaProducer: KafkaProducerService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(SponsorChangedService.name);
	}

	/**
	 * Processes a sponsor changed event.
	 * Queries the sponsor agent with contact methods and addresses,
	 * builds the Kafka payload, and sends it to Global_SMS_SponsorChanged_V2.
	 *
	 * @param applicantUuid - UUID of the applicant agent
	 * @param sponsorUuid - UUID of the sponsor agent
	 * @throws NotFoundException if sponsor agent is not found
	 */
	async processSponsorChanged(applicantUuid: string, sponsorUuid: string): Promise<void> {
		const startTime = Date.now();

		try {
			// Query sponsor agent with contact methods and addresses
			const selection = {
				include: ['contactMethod', 'address'],
			};
			const sponsorAgent = await this.agentRepository.findPage(
				{
					filter: {
						conditions: [{ field: 'id', operator: 'eq', value: sponsorUuid }],
						logicalOperator: 'AND',
					},
					limit: 1,
					offset: 0,
				},
				selection,
			);

			if (!sponsorAgent.items || sponsorAgent.items.length === 0) {
				throw new NotFoundException({
					message: `Sponsor agent with id '${sponsorUuid}' not found`,
					i18nType: 'agent.not_found',
				});
			}

			const agent = sponsorAgent.items[0] as Agent & {
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
			};

			// Build Kafka payload
			const message = this.buildSponsorChangedMessage(applicantUuid, agent);

			// Log the message payload before sending (for CloudWatch visibility)
			this.logger.info('Sponsor changed message payload - ready to send', {
				applicantUuid,
				sponsorUuid,
				message: message,
			});

			// Send to Kafka with applicantUuid as the message key for proper partitioning
			await this.kafkaProducer.sendSponsorChangedMessage(message, applicantUuid);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Sponsor changed message sent successfully for applicant ${applicantUuid} and sponsor ${sponsorUuid} in ${duration}ms`,
			);
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof NotFoundException) {
				throw error;
			}

			this.logger.error(
				`Failed to process sponsor changed event: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{
					applicantUuid,
					sponsorUuid,
					stack: error instanceof Error ? error.stack : undefined,
				},
			);

			throw error;
		}
	}

	/**
	 * Builds the sponsor changed Kafka message payload from agent data.
	 *
	 * @param applicantUuid - UUID of the applicant agent
	 * @param agent - Sponsor agent with contact methods and addresses
	 * @returns The formatted Kafka message payload
	 */
	private buildSponsorChangedMessage(
		applicantUuid: string,
		agent: Agent & {
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
		},
	): SponsorChangedMessage {
		// Extract primary email: first contact method where channel=email and isPrimary=true
		const primaryEmail = agent.contactMethod?.find(
			(cm) => cm.channel === 'email' && cm.isPrimary,
		);

		// Extract secondary email: first contact method where channel=email and isPrimary=false
		const secondaryEmail = agent.contactMethod?.find(
			(cm) => cm.channel === 'email' && !cm.isPrimary,
		);

		// Extract phone list: all contact methods where channel=phone
		const phoneList = (agent.contactMethod || [])
			.filter((cm) => cm.channel === 'phone')
			.map((cm) => ({
				PhoneType: cm.subType || 'mobile',
				Number: cm.value,
			}));

		// Extract address list: all addresses with their attributes
		const addressList = (agent.address || []).map((addr) => ({
			Line1: addr.line1,
			Line2: addr.line2 || undefined,
			Town: addr.city,
			State: addr.state?.code || undefined,
		}));

		return {
			ApplicantUuid: applicantUuid,
			Sponsor: {
				Uuid: agent.id,
				AgentUuid: agent.id,
				AgentID: agent.agentId || '',
				FirstName: agent.firstName,
				LastName: agent.lastName,
				Email: secondaryEmail?.value || '',
				ExpEmail: primaryEmail?.value || '',
				Description: '',
				TypeOfActor: 'Agent',
				PhoneList: phoneList,
				AddressList: addressList,
			},
		};
	}

	/**
	 * Processes a sponsor write-in event.
	 * Builds the Kafka payload with applicant UUID and sponsor write-in name,
	 * and sends it to Global_SMS_SponsorChanged_V2.
	 *
	 * @param applicantUuid - UUID of the applicant agent
	 * @param sponsorName - Sponsor name (write-in text value, may contain spaces)
	 */
	async processSponsorWriteIn(applicantUuid: string, sponsorName: string): Promise<void> {
		const startTime = Date.now();

		try {
			// Build Kafka payload
			const message = this.buildSponsorWriteInMessage(applicantUuid, sponsorName);

			// Log the message payload before sending (for CloudWatch visibility)
			this.logger.info('Sponsor write-in message payload - ready to send', {
				applicantUuid,
				sponsorName,
				message: message,
			});

			// Send to Kafka with applicantUuid as the message key for proper partitioning
			await this.kafkaProducer.sendSponsorChangedMessage(message, applicantUuid);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Sponsor write-in message sent successfully for applicant ${applicantUuid} with sponsor name "${sponsorName}" in ${duration}ms`,
			);
		} catch (error) {
			const duration = Date.now() - startTime;

			this.logger.error(
				`Failed to process sponsor write-in event: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{
					applicantUuid,
					sponsorName,
					stack: error instanceof Error ? error.stack : undefined,
				},
			);

			throw error;
		}
	}

	/**
	 * Builds the sponsor write-in Kafka message payload.
	 *
	 * @param applicantUuid - UUID of the applicant agent
	 * @param sponsorName - Sponsor name (write-in text value, may contain spaces)
	 * @returns The formatted Kafka message payload
	 */
	private buildSponsorWriteInMessage(
		applicantUuid: string,
		sponsorName: string,
	): SponsorWriteInMessage {
		return {
			ApplicantUuid: applicantUuid,
			SponsorWriteIn: {
				Name: sponsorName,
			},
		};
	}
}

