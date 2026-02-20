import { Injectable } from '@nestjs/common';
import { AgentUpsertExecutorService } from './agent-upsert-executor.service.js';

/**
 * Upsert service for AU Agent Details agent updated consumer.
 * Uses modifiedBy "Au" for audit.
 */
@Injectable()
export class AuAgentUpsertService {
	constructor(private readonly executor: AgentUpsertExecutorService) {}

	async upsertAgentWithAssociations(payload: unknown): Promise<void> {
		await this.executor.upsertAgentWithAssociations(payload, 'Au');
	}
}
