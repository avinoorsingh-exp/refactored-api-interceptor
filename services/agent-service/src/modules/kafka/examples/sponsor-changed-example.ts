/**
 * Example: How to produce a message to Global_SMS_SponsorChanged_V2 topic
 * 
 * This file demonstrates how to use the KafkaProducerService to send
 * sponsor change events to Kafka.
 */

import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../kafka-producer.service.js';

/**
 * Example service showing how to produce sponsor changed messages
 */
@Injectable()
export class SponsorChangedExampleService {
	constructor(private readonly kafkaProducer: KafkaProducerService) {}

	/**
	 * Example: Send a sponsor changed message when a sponsor relationship is created/updated
	 */
	async handleSponsorChange(params: {
		agentId: string;
		sponsorId: string;
		relationshipType: 'sponsor_primary' | 'sponsor_successor' | 'sponsor_adaptive';
		action: 'created' | 'updated' | 'deleted';
		timestamp?: Date;
	}): Promise<void> {
		const message = {
			agentId: params.agentId,
			sponsorId: params.sponsorId,
			relationshipType: params.relationshipType,
			action: params.action,
			timestamp: (params.timestamp || new Date()).toISOString(),
		};

		// Use agentId as the message key for partitioning (ensures all messages
		// for the same agent go to the same partition)
		await this.kafkaProducer.sendSponsorChangedMessage(
			message,
			params.agentId, // Message key for partitioning
			{
				'correlation-id': `sponsor-change-${Date.now()}`,
				'action': params.action,
			},
		);
	}
}

/**
 * Example message structure that will be produced:
 * 
 * Topic: Global_SMS_SponsorChanged_V2
 * Key: "agent-uuid-here" (optional, used for partitioning)
 * Headers: { "correlation-id": "...", "action": "created" }
 * Value (JSON stringified):
 * {
 *   "agentId": "550e8400-e29b-41d4-a716-446655440000",
 *   "sponsorId": "660e8400-e29b-41d4-a716-446655440001",
 *   "relationshipType": "sponsor_primary",
 *   "action": "created",
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 */


