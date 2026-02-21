import { Injectable } from '@nestjs/common';
import { AgentUpsertExecutorService } from './agent-upsert-executor.service.js';

/**
 * Upsert service for UK Agent Details agent updated consumer.
 * Uses modifiedBy "Uk" for audit.
 */
@Injectable()
export class UkAgentUpsertService {
	constructor(private readonly executor: AgentUpsertExecutorService) {}

	async upsertAgentWithAssociations(payload: unknown): Promise<void> {
		await this.executor.upsertAgentWithAssociations(payload, 'Uk');
	}
}
